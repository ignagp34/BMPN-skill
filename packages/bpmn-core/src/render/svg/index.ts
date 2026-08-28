import { buildScene, sceneBounds } from "./scene.js";
import { drawEdge, drawShape, markerDefs } from "./draw.js";
import { DARK_THEME, LIGHT_THEME, type Theme } from "./theme.js";

export type { Theme } from "./theme.js";
export { DARK_THEME, LIGHT_THEME } from "./theme.js";
export type { Bounds, Point, Scene, SceneEdge, SceneShape } from "./scene.js";

export interface SvgRenderOptions {
  /** Colour scheme. Defaults to the conventional black-on-white BPMN look. */
  theme?: Theme | "light" | "dark";
  /** Whitespace around the diagram, in diagram units. Default 20. */
  padding?: number;
  /**
   * Draw the `X` marker on exclusive gateways even when the DI omits
   * `isMarkerVisible`. Default true.
   */
  alwaysShowExclusiveMarker?: boolean;
  /** Scale factor baked into the `width`/`height` attributes. Default 1. */
  scale?: number;
}

function resolveTheme(theme: SvgRenderOptions["theme"]): Theme {
  if (theme === undefined || theme === "light") return LIGHT_THEME;
  if (theme === "dark") return DARK_THEME;
  return theme;
}

/**
 * Render BPMN XML that already carries diagram interchange into a standalone
 * SVG document.
 *
 * Pure Node: no DOM, no browser, no network. Feed it the output of
 * `layoutBpmnXml` (or any BPMN file that already has a `BPMNDiagram`).
 */
export async function renderBpmnSvg(
  layoutXml: string,
  options: SvgRenderOptions = {},
): Promise<string> {
  const theme = resolveTheme(options.theme);
  const padding = options.padding ?? 20;
  const scale = options.scale ?? 1;
  const alwaysShowExclusiveMarker = options.alwaysShowExclusiveMarker ?? true;

  const scene = await buildScene(layoutXml);
  const bounds = sceneBounds(scene);

  // Labels placed under events can spill past the shape box; widen the canvas
  // rather than clip them.
  const viewX = bounds.x - padding;
  const viewY = bounds.y - padding;
  const viewWidth = Math.max(bounds.width + padding * 2, 1);
  const viewHeight = Math.max(bounds.height + padding * 2, 1);

  const body = [
    ...scene.shapes
      .filter((shape) => shape.type === "Participant" || shape.type === "Lane")
      .map((shape) => drawShape(shape, { theme, alwaysShowExclusiveMarker })),
    ...scene.edges.map((edge) => drawEdge(edge, theme)),
    ...scene.shapes
      .filter((shape) => shape.type !== "Participant" && shape.type !== "Lane")
      .map((shape) => drawShape(shape, { theme, alwaysShowExclusiveMarker })),
  ].join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${Math.round(
    viewWidth * scale,
  )}" height="${Math.round(viewHeight * scale)}" viewBox="${round(viewX)} ${round(viewY)} ${round(
    viewWidth,
  )} ${round(viewHeight)}">
${markerDefs(theme)}
<rect x="${round(viewX)}" y="${round(viewY)}" width="${round(viewWidth)}" height="${round(
    viewHeight,
  )}" fill="${theme.fill}" />
${body}
</svg>
`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
