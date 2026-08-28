import { describe, expect, it } from "vitest";
import { layoutProcess } from "bpmn-auto-layout";
import BpmnModdle from "bpmn-moddle";

import { parseDsl, emitBpmnXml } from "../../src/dsl/index.js";
import { sanitizeForLayout } from "../../src/render/sanitize.js";
import { layoutMissingProcesses } from "../../src/render/layout-missing.js";
import { placePoolsAndLanes, extendOuterLanes } from "../../src/render/pools.js";
import { orthogonalize } from "../../src/render/orthogonal.js";
import { distributeParallelChannels } from "../../src/render/edge-channels.js";
import { placeLabels } from "../../src/render/labels.js";
import { placeArtifacts } from "../../src/render/artifacts.js";

/**
 * Multi-pool rendering regressions, reproducing the exact `renderSemanticXml`
 * chain minus the bpmn-js `modeler.importXML` step (which only consumes the XML
 * this chain produces). Two bugs this guards:
 *
 *  1. The diagram plane was rooted on the FIRST <bpmn:process>, so bpmn-js (and
 *     strict importers like Bizagi) rendered only that one process — every
 *     participant pool box and every other participant silently vanished.
 *  2. `extendOuterLanes` grew each participant to enclose ALL edge waypoints
 *     touching its nodes, including cross-pool MESSAGE flows, dragging adjacent
 *     pools into each other so they overlapped.
 */

async function exportLayout(dsl: string): Promise<string> {
  const { model } = parseDsl(dsl);
  let xml = await sanitizeForLayout(emitBpmnXml(model));
  xml = await layoutProcess(xml);
  xml = await layoutMissingProcesses(xml);
  xml = await placePoolsAndLanes(xml);
  xml = await orthogonalize(xml);
  xml = await distributeParallelChannels(xml);
  xml = await placeLabels(xml);
  xml = await extendOuterLanes(xml);
  xml = await placeArtifacts(xml);
  return xml;
}

type Box = { id: string; y: number; bottom: number };

async function participantBoxes(xml: string): Promise<{ planeRef: string; boxes: Box[] }> {
  const moddle = new BpmnModdle();
  const { rootElement } = (await moddle.fromXML(xml)) as { rootElement: any };
  const dg = rootElement.diagrams?.[0];
  const plane = dg?.plane;
  const planeRef = plane?.bpmnElement?.$type ?? "";
  const boxes: Box[] = [];
  for (const el of plane?.planeElement ?? []) {
    if (el.$type !== "bpmndi:BPMNShape") continue;
    if (el.bpmnElement?.$type !== "bpmn:Participant") continue;
    const b = el.bounds;
    boxes.push({ id: el.bpmnElement.id, y: b.y, bottom: b.y + b.height });
  }
  boxes.sort((a, b) => a.y - b.y);
  return { planeRef, boxes };
}

const MESSAGE_POOLS = [
  "Customer: Place order",
  "(send Order)",
  "(receive Confirmation)",
  "",
  "Sales: (receive Order)",
  "Sales: Check stock",
  "Warehouse: Pick items",
  "Sales: (send Confirmation)",
  "",
  "== pools ==",
  "Buyer -> Customer",
  "Seller -> Sales; Warehouse",
].join("\n");

describe("multi-pool layout", () => {
  it("roots the diagram plane on the collaboration so all participants render", async () => {
    const { planeRef, boxes } = await participantBoxes(await exportLayout(MESSAGE_POOLS));
    expect(planeRef).toBe("bpmn:Collaboration");
    expect(boxes.map((b) => b.id)).toEqual(["Participant_Buyer", "Participant_Seller"]);
  });

  it("stacks pools without overlap even when message flows cross between them", async () => {
    const { boxes } = await participantBoxes(await exportLayout(MESSAGE_POOLS));
    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i].y).toBeGreaterThanOrEqual(boxes[i - 1].bottom);
    }
  });

  it("renders every participant of a 4-pool collaboration, stacked (gemini-03)", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const dsl = readFileSync(resolve(__dirname, "..", "fixtures", "gemini-03.dsl"), "utf8");
    const { planeRef, boxes } = await participantBoxes(await exportLayout(dsl));
    expect(planeRef).toBe("bpmn:Collaboration");
    expect(boxes.length).toBe(4);
    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i].y).toBeGreaterThanOrEqual(boxes[i - 1].bottom);
    }
  });
});
