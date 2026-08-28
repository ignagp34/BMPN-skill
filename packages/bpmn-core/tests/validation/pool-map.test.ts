import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { describe, expect, it } from "vitest";
import type { DeclaredPool, FlowNode, MessageFlow, ResolvedModel, SequenceFlow } from "../../src/dsl/ast.js";
import { validateBpmnModel } from "../../src/validation/bpmnValidation.js";
import { parseDsl } from "../../src/dsl/index.js";

const fixturesDir = resolvePath(__dirname, "..", "fixtures");
const read = (name: string) => readFileSync(resolvePath(fixturesDir, name), "utf8");

function node(id: string, pool: string, kind: FlowNode["kind"] = "task"): FlowNode {
  return { annotations: [], id, kind, label: id, pool, sourceLine: 1 };
}

function model(opts: {
  nodes: FlowNode[];
  flows?: SequenceFlow[];
  messageFlows?: MessageFlow[];
  declaredPools?: DeclaredPool[];
  crossPoolControlFlows?: SequenceFlow[];
}): ResolvedModel {
  return {
    errors: [],
    flowNodes: new Map(opts.nodes.map((n) => [n.id, n])),
    flows: opts.flows ?? [],
    messageFlows: opts.messageFlows ?? [],
    pools: [],
    declaredPools: opts.declaredPools,
    crossPoolControlFlows: opts.crossPoolControlFlows,
  };
}

const codes = (result: ReturnType<typeof validateBpmnModel>): string[] =>
  [...result.errors, ...result.warnings, ...result.info].map((f) => f.code);

const poolCodes = (result: ReturnType<typeof validateBpmnModel>): string[] =>
  codes(result).filter((c) => c.startsWith("POOL_"));

describe("validatePoolMap — declaration diagnostics", () => {
  it("POOL_MAP_DUPLICATE_LANE when a lane is listed under two pools", () => {
    const result = validateBpmnModel(
      model({
        nodes: [node("t", "L")],
        declaredPools: [
          { name: "P1", lanes: ["L"], line: 1 },
          { name: "P2", lanes: ["L"], line: 2 },
        ],
      }),
    );
    expect(poolCodes(result)).toContain("POOL_MAP_DUPLICATE_LANE");
  });

  it("POOL_MAP_UNKNOWN_LANE when a declared lane never appears in the traces", () => {
    const result = validateBpmnModel(
      model({
        nodes: [node("t", "Used")],
        declaredPools: [{ name: "P", lanes: ["Used", "Ghost"], line: 1 }],
      }),
    );
    expect(poolCodes(result)).toEqual(["POOL_MAP_UNKNOWN_LANE"]);
  });

  it("POOL_MAP_LANE_UNASSIGNED when a used lane is in no declared pool", () => {
    const result = validateBpmnModel(
      model({
        nodes: [node("a", "A"), node("b", "B")],
        declaredPools: [{ name: "P", lanes: ["A"], line: 1 }],
      }),
    );
    expect(poolCodes(result)).toEqual(["POOL_MAP_LANE_UNASSIGNED"]);
  });

  it("POOL_MAP_NAME_COLLISION when a pool name is a different used role", () => {
    const result = validateBpmnModel(
      model({
        nodes: [node("a", "Cashier"), node("b", "Shop")],
        declaredPools: [
          { name: "Shop", lanes: ["Cashier"], line: 1 },
          { name: "Other", lanes: ["Shop"], line: 2 },
        ],
      }),
    );
    expect(poolCodes(result)).toEqual(["POOL_MAP_NAME_COLLISION"]);
  });

  it("does NOT flag a pool named after its own single lane (Customer -> Customer)", () => {
    const result = validateBpmnModel(
      model({
        nodes: [node("t", "Customer")],
        declaredPools: [{ name: "Customer", lanes: ["Customer"], line: 1 }],
      }),
    );
    expect(poolCodes(result)).not.toContain("POOL_MAP_NAME_COLLISION");
  });
});

describe("validatePoolMap — POOL_BOUNDARY_CONTROL_FLOW (missing message flow)", () => {
  it("fires for a cross-pool control-flow hand-off and points at a message flow", () => {
    const { model: m } = parseDsl(read("pool-map-missing-message-flow.dsl"));
    const result = validateBpmnModel(m);
    const boundary = [...result.warnings].filter((f) => f.code === "POOL_BOUNDARY_CONTROL_FLOW");
    expect(boundary).toHaveLength(1);
    expect(boundary[0].message).toMatch(/message flow/i);
    expect(boundary[0].message).toMatch(/Customer.*Support|Support.*Customer/);
  });

  it("does NOT fire when the interaction is modelled with message events", () => {
    const { model: m } = parseDsl(read("pool-map-message-event.dsl"));
    const result = validateBpmnModel(m);
    expect(poolCodes(result)).not.toContain("POOL_BOUNDARY_CONTROL_FLOW");
  });

  it("emits no POOL_* findings for a model without a == pools == block (back-compat)", () => {
    const { model: m } = parseDsl(read("s17-order-to-ship.dsl"));
    const result = validateBpmnModel(m);
    expect(poolCodes(result)).toEqual([]);
  });
});
