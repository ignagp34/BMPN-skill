import { describe, expect, it } from "vitest";
import { parseDsl } from "../../src/dsl/index.js";
import type { FlowNode } from "../../src/dsl/ast.js";

/**
 * V5 trailing `== pools ==` block — lexing/parsing into Program.declaredPools and
 * the semantic-pass partition of cross-declared-pool sequence flows (export-safe
 * P1). The block is optional and absent input must behave exactly as before.
 */

const MISSING_MF = [
  "Customer: Submit request",
  "Support Agent: Triage request",
  "Team Lead: Escalate and resolve",
  "",
  "== pools ==",
  "Customer -> Customer",
  "Support -> Support Agent; Team Lead",
].join("\n");

const MESSAGE_EVENT = [
  "Customer: Submit request",
  "(send Request)",
  "",
  "Support Agent: (receive Request)",
  "Triage request",
  "Team Lead: Escalate and resolve",
  "",
  "== pools ==",
  "Customer -> Customer",
  "Support -> Support Agent; Team Lead",
].join("\n");

describe("== pools == block parsing", () => {
  it("parses declared pools into Program.declaredPools in order", () => {
    const { program } = parseDsl(MISSING_MF);
    expect(program.declaredPools).toBeDefined();
    expect(program.declaredPools).toHaveLength(2);
    expect(program.declaredPools![0]).toMatchObject({ name: "Customer", lanes: ["Customer"] });
    expect(program.declaredPools![1]).toMatchObject({
      name: "Support",
      lanes: ["Support Agent", "Team Lead"],
    });
  });

  it("accepts a case-insensitive header with flexible spacing", () => {
    const { program } = parseDsl("A: do\nB: do more\n\n==Pools==\nGroup -> A; B\n");
    expect(program.declaredPools).toHaveLength(1);
    expect(program.declaredPools![0]).toMatchObject({ name: "Group", lanes: ["A", "B"] });
  });

  it("warns on a malformed entry (missing '->') and skips it", () => {
    const { program, errors } = parseDsl("A: do\n\n== pools ==\nthis line has no arrow\n");
    expect(errors.some((e) => e.code === "LEX-1" && /->/.test(e.message))).toBe(true);
    expect(program.declaredPools).toBeUndefined();
  });

  it("leaves declaredPools undefined when there is no block (back-compat)", () => {
    const { program } = parseDsl("Customer: Place order\nShop: Check payment\n");
    expect(program.declaredPools).toBeUndefined();
  });

  it("does not change trace parsing — block lines never become tasks", () => {
    const withBlock = parseDsl(MISSING_MF);
    const withoutBlock = parseDsl(
      ["Customer: Submit request", "Support Agent: Triage request", "Team Lead: Escalate and resolve"].join("\n"),
    );
    const tasks = (r: ReturnType<typeof parseDsl>) =>
      [...r.model.flowNodes.values()].filter((n) => n.kind === "task").length;
    expect(tasks(withBlock)).toBe(tasks(withoutBlock));
  });
});

describe("cross-pool control flow partition (export-safe P1)", () => {
  it("moves a cross-declared-pool sequence flow into crossPoolControlFlows", () => {
    const { model } = parseDsl(MISSING_MF);
    expect(model.crossPoolControlFlows).toBeDefined();
    expect(model.crossPoolControlFlows).toHaveLength(1);
    const crossed = model.crossPoolControlFlows![0];
    expect(model.flowNodes.get(crossed.sourceId)?.pool).toBe("Customer");
    expect(model.flowNodes.get(crossed.targetId)?.pool).toBe("Support Agent");
    // …and the illegal edge is pruned from the exported flow set.
    expect(model.flows.some((f) => f.id === crossed.id)).toBe(false);
  });

  it("keeps intra-pool lane-crossing flows (Support Agent -> Team Lead share pool 'Support')", () => {
    const { model } = parseDsl(MISSING_MF);
    const kept = model.flows.some((f) => {
      const s = model.flowNodes.get(f.sourceId);
      const t = model.flowNodes.get(f.targetId);
      return s?.pool === "Support Agent" && t?.pool === "Team Lead";
    });
    expect(kept).toBe(true);
  });

  it("completes the now-disconnected pools with synthesized start/end events", () => {
    const { model } = parseDsl(MISSING_MF);
    const nodes = [...model.flowNodes.values()];
    const implicitEndInCustomer = nodes.some(
      (n: FlowNode) => n.kind === "endEvent" && n.id.startsWith("EndEvent_implicit") && n.pool === "Customer",
    );
    const implicitStartInSupport = nodes.some(
      (n: FlowNode) => n.kind === "startEvent" && n.id.startsWith("StartEvent_implicit") && n.pool === "Support Agent",
    );
    expect(implicitEndInCustomer).toBe(true);
    expect(implicitStartInSupport).toBe(true);
  });

  it("a correctly-modelled message-event interaction has no cross-pool control flow", () => {
    const { model } = parseDsl(MESSAGE_EVENT);
    expect(model.crossPoolControlFlows).toBeUndefined();
    expect(model.messageFlows.length).toBeGreaterThanOrEqual(1);
  });
});
