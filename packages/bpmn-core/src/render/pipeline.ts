import { layoutProcess } from "bpmn-auto-layout";
import BpmnModdle from "bpmn-moddle";

import { sanitizeForLayout } from "./sanitize.js";
import { layoutMissingProcesses } from "./layout-missing.js";
import { placeArtifacts } from "./artifacts.js";
import { placePoolsAndLanes, extendOuterLanes } from "./pools.js";
import { orthogonalize } from "./orthogonal.js";
import { distributeParallelChannels } from "./edge-channels.js";
import { placeLabels } from "./labels.js";

/**
 * The M4 layout pipeline: semantic BPMN XML in, BPMN XML carrying complete
 * diagram interchange (DI) out.
 *
 *   1. sanitize semantic XML for bpmn-auto-layout
 *   2. bpmn-auto-layout
 *   3. place pool/lane shapes + seed message-flow edges
 *   4. orthogonalize control flow and distribute parallel channels
 *   5. place labels and artifacts in local whitespace near attached nodes
 *
 * Every stage runs on bpmn-moddle alone, so this whole pipeline is pure Node —
 * no DOM, no browser. Only turning the resulting DI into pixels needs a
 * renderer (see `./svg/index.ts` for the headless one, or `./index.ts` for the
 * bpmn-js canvas one).
 */
export async function layoutBpmnXml(xml: string): Promise<string> {
  const cleaned = await sanitizeForLayout(xml);
  let layoutXml: string;
  try {
    layoutXml = await layoutProcess(cleaned);
  } catch (err) {
    throw new Error(`bpmn-auto-layout failed: ${(err as Error).message}`);
  }
  layoutXml = await layoutMissingProcesses(layoutXml);
  layoutXml = await placePoolsAndLanes(layoutXml);
  layoutXml = await orthogonalize(layoutXml);
  layoutXml = await distributeParallelChannels(layoutXml);
  layoutXml = await placeLabels(layoutXml);
  layoutXml = await extendOuterLanes(layoutXml);
  return placeArtifacts(layoutXml);
}

/** True when the XML already carries diagram interchange (shape coordinates). */
export async function containsDiagramInterchange(xml: string): Promise<boolean> {
  const moddle = new BpmnModdle();
  const { rootElement } = await moddle.fromXML(xml);
  const definitions = rootElement as { diagrams?: unknown[] };
  return Array.isArray(definitions.diagrams) && definitions.diagrams.length > 0;
}
