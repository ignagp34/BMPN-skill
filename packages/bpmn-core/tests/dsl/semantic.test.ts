import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { describe, it, expect } from "vitest";
import { parseDsl } from "../../src/dsl/index.js";

const fixturesDir = resolvePath(__dirname, "..", "fixtures");
const read = (name: string) => readFileSync(resolvePath(fixturesDir, name), "utf8");

describe("anchor-boundary violations", () => {
  it("AP-6: regular trace ends at a fragment leading-anchor without trailing '...'", () => {
    const r = parseDsl(read("_invalid/ap6-trace-ends-at-anchor.dsl"));
    const ap6 = r.errors.filter((e) => e.code === "AP-6");
    expect(ap6.length).toBeGreaterThanOrEqual(1);
    expect(ap6[0].severity).toBe("error");
    expect(ap6[0].message).toMatch(/Decide on hiring/);
  });

  it("AP-7: anchor task buried in fragment interior", () => {
    const r = parseDsl(read("_invalid/ap7-anchor-buried.dsl"));
    const ap7 = r.errors.filter((e) => e.code === "AP-7");
    expect(ap7.length).toBeGreaterThanOrEqual(1);
    expect(ap7[0].severity).toBe("error");
  });

  it("Errors do not abort: a model is still produced for AP-6 input", () => {
    const r = parseDsl(read("_invalid/ap6-trace-ends-at-anchor.dsl"));
    expect(r.model.flowNodes.size).toBeGreaterThan(0);
  });
});

describe("code-fence stripping", () => {
  it("wrapping a valid fixture in ``` produces an identical AST shape", () => {
    const raw = read("s17-order-to-ship.dsl");
    const fenced = "```\n" + raw + "```\n";
    const a = parseDsl(raw);
    const b = parseDsl(fenced);
    expect(b.program.traces.length).toBe(a.program.traces.length);
    expect(b.model.flowNodes.size).toBe(a.model.flowNodes.size);
  });

  it("gemini-05 parses through its actual leading/trailing ``` fences", () => {
    const r = parseDsl(read("gemini-05.dsl"));
    const errors = r.errors.filter((e) => e.severity === "error");
    expect(errors).toEqual([]);
  });
});

describe("inline '//' annotation tolerance", () => {
  it("strips inline '// note' from a task line and emits an INLINE-COMMENT warning", () => {
    const src = "Customer: Place order // urgent\nShop: Confirm\n";
    const r = parseDsl(src);
    const warn = r.errors.find((e) => e.code === "INLINE-COMMENT");
    expect(warn).toBeDefined();
    expect(warn?.severity).toBe("warning");
    const placeOrder = [...r.model.flowNodes.values()].find((n) => n.label === "Place order");
    expect(placeOrder).toBeDefined();
    expect(placeOrder?.annotations).toContain("urgent");
  });
});

describe("implicit start/end event synthesis", () => {
  it("synthesizes an implicit end event for a trace tail that lacks an explicit finish", () => {
    const src = "Customer: Place order\nShop: Confirm order\n";
    const r = parseDsl(src);
    const ends = [...r.model.flowNodes.values()].filter((n) => n.kind === "endEvent");
    expect(ends.length).toBe(1);
    expect(ends[0].id.startsWith("EndEvent_implicit")).toBe(true);
    // The tail task now has an outgoing flow into the synthesized end event.
    const confirm = [...r.model.flowNodes.values()].find((n) => n.label === "Confirm order");
    expect(confirm).toBeDefined();
    const outgoing = r.model.flows.filter((f) => f.sourceId === confirm?.id);
    expect(outgoing.length).toBe(1);
    expect(outgoing[0].targetId).toBe(ends[0].id);
  });

  it("does not synthesize an end event when the trace already ends with an explicit finish", () => {
    const src = "Customer: Place order\nShop: Confirm order\n(finish Order confirmed)\n";
    const r = parseDsl(src);
    const ends = [...r.model.flowNodes.values()].filter((n) => n.kind === "endEvent");
    expect(ends.length).toBe(1);
    expect(ends[0].id.startsWith("EndEvent_implicit")).toBe(false);
    expect(ends[0].label).toBe("Order confirmed");
  });

  it("adds one implicit end per distinct branch outcome", () => {
    const src = [
      "Inspect application",
      "Accept application",
      "",
      "Inspect application",
      "Reject application",
      "",
    ].join("\n");
    const r = parseDsl(src);
    const ends = [...r.model.flowNodes.values()].filter((n) => n.kind === "endEvent");
    // Two distinct outcomes (Accept / Reject) → two synthesized end events.
    expect(ends.length).toBe(2);
    expect(ends.every((n) => n.id.startsWith("EndEvent_implicit"))).toBe(true);
  });

  it("completes a dangling boundary event with a synthesized end event", () => {
    // A trace ending on an interrupting boundary leaves it with no outgoing flow —
    // which both crashes bpmn-auto-layout and is semantically incomplete.
    const src = ["Support Agent: Investigate issue", "Work on resolution", "(deadline SLA deadline)"].join("\n");
    const r = parseDsl(src);
    const boundary = [...r.model.flowNodes.values()].find((n) => n.kind === "boundaryEvent");
    expect(boundary).toBeDefined();
    const out = r.model.flows.filter((f) => f.sourceId === boundary!.id);
    expect(out.length).toBe(1);
    const target = r.model.flowNodes.get(out[0].targetId);
    expect(target?.kind).toBe("endEvent");
    expect(target?.id.startsWith("EndEvent_implicit")).toBe(true);
  });
});

describe("lane prefix parsing — dotted and lowercase names", () => {
  it("parses a lowercase, dotted lane prefix as a pool (e.g. 'src.train:')", () => {
    const src = "src.train: Do the thing\nsrc.train: Next step\n";
    const r = parseDsl(src);
    expect(r.model.pools.map((p) => p.name)).toContain("src.train");
    const labels = [...r.model.flowNodes.values()]
      .filter((n) => n.kind === "task")
      .map((n) => n.label);
    expect(labels).toContain("Do the thing");
    expect(labels).toContain("Next step");
  });

  it("parses a dotted uppercase lane prefix (e.g. 'Src.Train:')", () => {
    const r = parseDsl("Src.Train: Do the thing\nSrc.Train: Next\n");
    expect(r.model.pools.map((p) => p.name)).toContain("Src.Train");
  });

  it("handles a typed-task line with a dotted lane name", () => {
    const r = parseDsl("user Gate.Agent: Scan Passes\n");
    const task = [...r.model.flowNodes.values()].find((n) => n.label === "Scan Passes");
    expect(task?.pool).toBe("Gate.Agent");
    expect(task?.taskType).toBe("user");
  });
});

describe("message end events", () => {
  it("classifies a terminal '(message …)' as a message end event", () => {
    const src = "Customer: Place order\nShop: Confirm order\n(message Confirmation sent)\n";
    const r = parseDsl(src);
    const ends = [...r.model.flowNodes.values()].filter((n) => n.kind === "endEvent");
    expect(ends.length).toBe(1);
    expect(ends[0].eventType).toBe("message");
    // It is an explicit end, not the synthesized implicit one.
    expect(ends[0].id.startsWith("EndEvent_implicit")).toBe(false);
  });

  it("a '(message …)' in start position is still a message start event", () => {
    const r = parseDsl("(message Order received)\nProcess order\n");
    const starts = [...r.model.flowNodes.values()].filter((n) => n.kind === "startEvent");
    expect(starts.some((n) => n.eventType === "message")).toBe(true);
  });
});

describe("pool first-mention persistence", () => {
  it("a task first seen with an explicit pool keeps that pool when re-mentioned without prefix", () => {
    const src = `Customer: Place order
Shop: Acknowledge

Place order
Shop: Process
`;
    const r = parseDsl(src);
    const placeOrders = [...r.model.flowNodes.values()].filter((n) => n.label === "Place order");
    expect(placeOrders.length).toBe(1);
    expect(placeOrders[0].pool).toBe("Customer");
  });

  it("canon-2 does not register a synthetic Pool_1 for the unlabeled opening start event", () => {
    const r = parseDsl(read("canon-2-incoming-flight.dsl"));
    expect(r.program.pools.map((p) => p.name)).not.toContain("Pool_1");
  });
});

describe("annotation attachment", () => {
  it("a leading '//' annotation attaches to the next task", () => {
    const src = `Customer:
//Includes near misses
Place order
`;
    const r = parseDsl(src);
    const placeOrder = [...r.model.flowNodes.values()].find((n) => n.label === "Place order");
    expect(placeOrder?.annotations).toContain("Includes near misses");
  });
});

describe("parallel rows", () => {
  it("a parallel row creates a parallelGateway node and lane tasks", () => {
    const src = `HR: Inspect Dossier|Check References
Decide
`;
    const r = parseDsl(src);
    const parallel = [...r.model.flowNodes.values()].find((n) => n.kind === "parallelGateway");
    expect(parallel).toBeDefined();
    const inspect = [...r.model.flowNodes.values()].find((n) => n.label === "Inspect Dossier");
    const refs = [...r.model.flowNodes.values()].find((n) => n.label === "Check References");
    expect(inspect).toBeDefined();
    expect(refs).toBeDefined();
  });
});

describe("data object identity", () => {
  it("canon-5 reuses repeated opening data objects across both traces", () => {
    const r = parseDsl(read("canon-5-marriage.dsl"));
    const labels = [...r.model.flowNodes.values()]
      .filter((n) => n.kind === "dataObject" || n.kind === "dataStore")
      .map((n) => n.label);

    expect(labels.filter((label) => label === "Unapostilled Documents")).toHaveLength(1);
    expect(labels.filter((label) => label === "Apostilled Documents")).toHaveLength(1);
    expect(labels.filter((label) => label === "Spanish Documents")).toHaveLength(1);
  });

  it("deduplicates repeated leading data inputs before Pool_1 fallback is inferred", () => {
    const r = parseDsl(read("s17-document-approval.dsl"));
    const draftDocs = [...r.model.flowNodes.values()].filter(
      (n) => n.kind === "dataObject" && n.label === "Draft Document",
    );

    expect(draftDocs).toHaveLength(1);
    expect(draftDocs[0].attachedInputOf).toBeDefined();
  });
});
