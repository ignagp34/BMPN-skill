import type BpmnModeler from "bpmn-js/lib/Modeler";

import type { ResolvedModel } from "../dsl/ast.js";
import { containsDiagramInterchange, layoutBpmnXml } from "./pipeline.js";

export { layoutBpmnXml, containsDiagramInterchange } from "./pipeline.js";

export interface RenderOptions {
  /** Vertical stride between lane rows. Default 80. */
  laneGrid?: number;
}

export interface RenderResult {
  layoutXml: string;
  warnings: unknown[];
}

export interface RawBpmnRenderResult extends RenderResult {
  usedAutoLayout: boolean;
}

async function importAndFit(
  modeler: BpmnModeler,
  layoutXml: string,
): Promise<unknown[]> {
  const { warnings } = await modeler.importXML(layoutXml);
  const canvas = modeler.get<{ zoom: (level: string) => void }>("canvas");
  canvas.zoom("fit-viewport");
  return warnings;
}

/**
 * Run the layout pipeline (see `./pipeline.ts`) and import the result into a
 * live bpmn-js modeler, zoomed to fit.
 *
 * This entry point requires a DOM. Headless callers should use
 * `layoutBpmnXml` + `renderBpmnSvg` from `@text-to-bpmn/core/headless`.
 */
export async function renderSemanticXml(
  modeler: BpmnModeler,
  semanticXml: string,
  _model: ResolvedModel,
  _opts: RenderOptions = {},
): Promise<RenderResult> {
  const layoutXml = await layoutBpmnXml(semanticXml);
  const warnings = await importAndFit(modeler, layoutXml);
  return { layoutXml, warnings };
}

/**
 * Import arbitrary model-authored BPMN XML without involving the DSL model.
 *
 * XML that already carries BPMN DI is imported byte-for-byte. XML without DI
 * is sanitized only for the render attempt and passed through the same layout
 * pipeline used by the DSL renderer. Callers must retain and score the original
 * raw XML separately; `layoutXml` is a visualization artifact only.
 */
export async function renderRawBpmnXml(
  modeler: BpmnModeler,
  rawXml: string,
): Promise<RawBpmnRenderResult> {
  const usedAutoLayout = !(await containsDiagramInterchange(rawXml));
  const layoutXml = usedAutoLayout ? await layoutBpmnXml(rawXml) : rawXml;
  const warnings = await importAndFit(modeler, layoutXml);
  return { layoutXml, warnings, usedAutoLayout };
}
