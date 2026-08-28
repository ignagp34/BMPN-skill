import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { describe, expect, it } from "vitest";
import BpmnModdle from "bpmn-moddle";
import { parseDsl } from "../../src/dsl/index.js";
import { emitBpmnXml } from "../../src/bpmn/emit.js";

const fixturesDir = resolvePath(__dirname, "..", "fixtures");
const read = (name: string) => readFileSync(resolvePath(fixturesDir, name), "utf8");

/** Index of the first match of `re` in `xml`, or -1. */
function indexOf(xml: string, re: RegExp): number {
  return xml.search(re);
}

/**
 * Assert (via bpmn-moddle) that no sequence flow crosses a process/participant
 * boundary — the property that keeps the export importable in strict tools like
 * Bizagi. A cross-pool sequence flow is non-conformant BPMN; the export-safe P1
 * policy guarantees none is ever serialized.
 */
async function expectNoCrossProcessSequenceFlow(xml: string): Promise<void> {
  const moddle = new BpmnModdle();
  const { rootElement } = (await moddle.fromXML(xml)) as { rootElement: any };
  const processes = (rootElement.rootElements ?? []).filter((e: any) => e.$type === "bpmn:Process");
  for (const proc of processes) {
    const ids = new Set((proc.flowElements ?? []).map((e: any) => e.id));
    for (const el of proc.flowElements ?? []) {
      if (el.$type !== "bpmn:SequenceFlow") continue;
      const sourceId = el.sourceRef?.id ?? el.sourceRef;
      const targetId = el.targetRef?.id ?? el.targetRef;
      expect(ids.has(sourceId), `sequence flow ${el.id} source escapes its process`).toBe(true);
      expect(ids.has(targetId), `sequence flow ${el.id} target escapes its process`).toBe(true);
    }
  }
}

describe("emitBpmnXml — V5 pool map", () => {
  it("names participants after the declared pool, not the first lane", () => {
    const { model } = parseDsl(read("pool-map-missing-message-flow.dsl"));
    const xml = emitBpmnXml(model);
    expect(xml).toMatch(/<bpmn:participant[^>]*name="Support"/);
    expect(xml).toMatch(/<bpmn:participant[^>]*name="Customer"/);
    // "Support Agent" is a lane inside the "Support" participant, never a pool name.
    expect(xml).not.toMatch(/<bpmn:participant[^>]*name="Support Agent"/);
  });

  it("renders the Support pool's lanes in declared order (Support Agent before Team Lead)", () => {
    const { model } = parseDsl(read("pool-map-missing-message-flow.dsl"));
    const xml = emitBpmnXml(model);
    const agentAt = indexOf(xml, /<bpmn:lane[^>]*name="Support Agent"/);
    const leadAt = indexOf(xml, /<bpmn:lane[^>]*name="Team Lead"/);
    expect(agentAt).toBeGreaterThanOrEqual(0);
    expect(leadAt).toBeGreaterThanOrEqual(0);
    expect(agentAt).toBeLessThan(leadAt);
  });

  it("never serializes a cross-pool sequence flow (Bizagi-safe export)", async () => {
    const { model } = parseDsl(read("pool-map-missing-message-flow.dsl"));
    const xml = emitBpmnXml(model);
    await expectNoCrossProcessSequenceFlow(xml);
  });

  it("the corrected message-event variant emits a message flow and stays valid", async () => {
    const { model } = parseDsl(read("pool-map-message-event.dsl"));
    const xml = emitBpmnXml(model);
    expect(model.messageFlows.length).toBeGreaterThanOrEqual(1);
    expect(xml).toMatch(/<bpmn:messageFlow/);
    await expectNoCrossProcessSequenceFlow(xml);
  });
});
