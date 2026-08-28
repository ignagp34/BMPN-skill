/// <reference path="./ambient.d.ts" />

/**
 * `@text-to-bpmn/core/headless` — the browser-free surface of the engine.
 *
 * Everything reachable from here runs on plain Node: DSL parsing, BPMN 2.0
 * emission, the full layout pipeline, SVG rendering, and validation. Nothing
 * imports bpmn-js, touches the DOM, or reaches the network, which is what lets
 * the whole engine bundle into a single file for the `/bpmn` skill.
 *
 * Browser callers that want a live, editable canvas should keep using the
 * default entry point (`@text-to-bpmn/core`) with a bpmn-js modeler.
 */

import { parseDsl } from "./dsl/index.js";
import { emitBpmnXml } from "./bpmn/emit.js";
import { layoutBpmnXml } from "./render/pipeline.js";
import { renderBpmnSvg, type SvgRenderOptions } from "./render/svg/index.js";
import { validateBpmnModel, type BpmnValidationResult } from "./validation/bpmnValidation.js";
import type { ParseResult } from "./dsl/ast.js";

export { parseDsl } from "./dsl/index.js";
export { emitBpmnXml } from "./bpmn/emit.js";
export { layoutBpmnXml, containsDiagramInterchange } from "./render/pipeline.js";
export {
  renderBpmnSvg,
  DARK_THEME,
  LIGHT_THEME,
  type SvgRenderOptions,
  type Theme,
  type Bounds,
  type Point,
  type Scene,
  type SceneEdge,
  type SceneShape,
} from "./render/svg/index.js";
export {
  renderSvgToPng,
  findSystemSansFont,
  setWasmLoader,
  type PngRenderOptions,
} from "./render/svg/png.js";
export {
  validateBpmnModel,
  type BpmnValidationFinding,
  type BpmnValidationMetrics,
  type BpmnValidationOptions,
  type BpmnValidationOrigin,
  type BpmnValidationResult,
  type BpmnValidationSeverity,
  type BpmnValidationStatus,
} from "./validation/bpmnValidation.js";
export * from "./dsl/ast.js";

export interface RenderDslOptions extends SvgRenderOptions {}

export interface RenderDslResult {
  /** Parse result, including any DSL syntax/semantic errors. */
  parse: ParseResult;
  /** Semantic BPMN 2.0 XML, without coordinates. */
  semanticXml: string;
  /** BPMN 2.0 XML with complete diagram interchange — the `.bpmn` deliverable. */
  layoutXml: string;
  /** Standalone SVG document. */
  svg: string;
  validation: BpmnValidationResult;
}

/**
 * DSL in, diagram out — the whole pipeline in one call, entirely offline.
 *
 * Throws when the DSL fails to parse into a model at all; recoverable problems
 * come back as `parse.errors` and `validation.findings` so callers can show a
 * diagram *and* the reasons it may be wrong.
 */
export async function renderDsl(
  dsl: string,
  options: RenderDslOptions = {},
): Promise<RenderDslResult> {
  const parse = parseDsl(dsl);
  const semanticXml = emitBpmnXml(parse.model);
  const layoutXml = await layoutBpmnXml(semanticXml);
  const svg = await renderBpmnSvg(layoutXml, options);
  const validation = validateBpmnModel(parse.model, { layoutXml });
  return { parse, semanticXml, layoutXml, svg, validation };
}
