import type { Bounds, EventDefinition, Point, SceneEdge, SceneShape } from "./scene.js";
import type { Theme } from "./theme.js";
import {
  ANNOTATION_FONT_SIZE,
  ANNOTATION_LINE_HEIGHT,
  annotationContentWidth,
  escapeXml,
  measureText,
  wrapText,
} from "./text.js";

/**
 * Glyph library for the headless renderer.
 *
 * Every BPMN symbol here is drawn from SVG primitives against the OMG BPMN 2.0
 * shape vocabulary — no third-party render code or path data is reused, which
 * is what keeps the output free of the bpmn.io attribution watermark while
 * still looking like the notation people expect.
 */

const TASK_TYPES = new Set([
  "Task",
  "UserTask",
  "ServiceTask",
  "SendTask",
  "ReceiveTask",
  "ManualTask",
  "ScriptTask",
  "BusinessRuleTask",
  "CallActivity",
  "SubProcess",
]);

const EVENT_TYPES = new Set([
  "StartEvent",
  "EndEvent",
  "IntermediateCatchEvent",
  "IntermediateThrowEvent",
  "BoundaryEvent",
]);

const GATEWAY_TYPES = new Set([
  "ExclusiveGateway",
  "ParallelGateway",
  "InclusiveGateway",
  "EventBasedGateway",
  "ComplexGateway",
]);

/** Events that *throw* render their definition glyph filled, not outlined. */
const THROWING_EVENTS = new Set(["EndEvent", "IntermediateThrowEvent"]);

export const POOL_HEADER_WIDTH = 30;

function attrs(map: Record<string, string | number | undefined>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(map)) {
    if (value === undefined) continue;
    parts.push(`${key}="${escapeXml(String(value))}"`);
  }
  return parts.length === 0 ? "" : ` ${parts.join(" ")}`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function points(list: Point[]): string {
  return list.map((point) => `${round(point.x)},${round(point.y)}`).join(" ");
}

// ---------------------------------------------------------------------------
// Event definition glyphs
// ---------------------------------------------------------------------------

function envelope(cx: number, cy: number, size: number, filled: boolean, theme: Theme): string {
  const width = size;
  const height = size * 0.72;
  const x = cx - width / 2;
  const y = cy - height / 2;
  const stroke = filled ? theme.fill : theme.stroke;
  return [
    `<rect${attrs({
      x: round(x),
      y: round(y),
      width: round(width),
      height: round(height),
      fill: filled ? theme.solid : theme.fill,
      stroke: theme.stroke,
      "stroke-width": 1.5,
    })} />`,
    `<polyline${attrs({
      points: points([
        { x, y },
        { x: cx, y: y + height * 0.62 },
        { x: x + width, y },
      ]),
      fill: "none",
      stroke,
      "stroke-width": 1.5,
    })} />`,
  ].join("");
}

function clock(cx: number, cy: number, size: number, theme: Theme): string {
  const r = size / 2;
  const ticks: string[] = [];
  for (let i = 0; i < 12; i += 1) {
    const angle = (i * Math.PI) / 6;
    const outer = { x: cx + Math.sin(angle) * r, y: cy - Math.cos(angle) * r };
    const inner = { x: cx + Math.sin(angle) * r * 0.8, y: cy - Math.cos(angle) * r * 0.8 };
    ticks.push(
      `<line${attrs({
        x1: round(inner.x),
        y1: round(inner.y),
        x2: round(outer.x),
        y2: round(outer.y),
        stroke: theme.stroke,
        "stroke-width": 1,
      })} />`,
    );
  }
  return [
    `<circle${attrs({
      cx: round(cx),
      cy: round(cy),
      r: round(r),
      fill: theme.fill,
      stroke: theme.stroke,
      "stroke-width": 1.5,
    })} />`,
    ...ticks,
    `<polyline${attrs({
      points: points([
        { x: cx, y: cy - r * 0.62 },
        { x: cx, y: cy },
        { x: cx + r * 0.45, y: cy + r * 0.3 },
      ]),
      fill: "none",
      stroke: theme.stroke,
      "stroke-width": 1.5,
      "stroke-linecap": "round",
    })} />`,
  ].join("");
}

function bolt(cx: number, cy: number, size: number, filled: boolean, theme: Theme): string {
  const w = size * 0.62;
  const h = size;
  const left = cx - w / 2;
  const top = cy - h / 2;
  const shape: Point[] = [
    { x: left, y: top + h },
    { x: left + w * 0.42, y: top + h * 0.52 },
    { x: left + w * 0.12, y: top + h * 0.44 },
    { x: left + w, y: top },
    { x: left + w * 0.56, y: top + h * 0.46 },
    { x: left + w * 0.9, y: top + h * 0.54 },
  ];
  return `<polygon${attrs({
    points: points(shape),
    fill: filled ? theme.solid : theme.fill,
    stroke: theme.stroke,
    "stroke-width": 1.5,
    "stroke-linejoin": "round",
  })} />`;
}

function escalation(cx: number, cy: number, size: number, filled: boolean, theme: Theme): string {
  const h = size;
  const w = size * 0.66;
  const top = cy - h / 2;
  const shape: Point[] = [
    { x: cx, y: top },
    { x: cx + w / 2, y: top + h },
    { x: cx, y: top + h * 0.58 },
    { x: cx - w / 2, y: top + h },
  ];
  return `<polygon${attrs({
    points: points(shape),
    fill: filled ? theme.solid : theme.fill,
    stroke: theme.stroke,
    "stroke-width": 1.5,
    "stroke-linejoin": "round",
  })} />`;
}

function signal(cx: number, cy: number, size: number, filled: boolean, theme: Theme): string {
  const h = size * 0.86;
  const top = cy - h / 2;
  const shape: Point[] = [
    { x: cx, y: top },
    { x: cx + size / 2, y: top + h },
    { x: cx - size / 2, y: top + h },
  ];
  return `<polygon${attrs({
    points: points(shape),
    fill: filled ? theme.solid : theme.fill,
    stroke: theme.stroke,
    "stroke-width": 1.5,
    "stroke-linejoin": "round",
  })} />`;
}

function link(cx: number, cy: number, size: number, filled: boolean, theme: Theme): string {
  const w = size;
  const h = size * 0.6;
  const left = cx - w / 2;
  const top = cy - h / 2;
  const shape: Point[] = [
    { x: left, y: top + h * 0.3 },
    { x: left + w * 0.55, y: top + h * 0.3 },
    { x: left + w * 0.55, y: top },
    { x: left + w, y: cy },
    { x: left + w * 0.55, y: top + h },
    { x: left + w * 0.55, y: top + h * 0.7 },
    { x: left, y: top + h * 0.7 },
  ];
  return `<polygon${attrs({
    points: points(shape),
    fill: filled ? theme.solid : theme.fill,
    stroke: theme.stroke,
    "stroke-width": 1.5,
    "stroke-linejoin": "round",
  })} />`;
}

function terminate(cx: number, cy: number, size: number, theme: Theme): string {
  return `<circle${attrs({
    cx: round(cx),
    cy: round(cy),
    r: round(size / 2),
    fill: theme.solid,
    stroke: theme.stroke,
    "stroke-width": 1,
  })} />`;
}

function eventGlyph(
  definition: EventDefinition,
  cx: number,
  cy: number,
  size: number,
  filled: boolean,
  theme: Theme,
): string {
  switch (definition) {
    case "message":
      return envelope(cx, cy, size, filled, theme);
    case "timer":
      return clock(cx, cy, size * 1.1, theme);
    case "error":
      return bolt(cx, cy, size, filled, theme);
    case "escalation":
      return escalation(cx, cy, size, filled, theme);
    case "signal":
      return signal(cx, cy, size, filled, theme);
    case "link":
      return link(cx, cy, size, filled, theme);
    case "terminate":
      return terminate(cx, cy, size * 0.85, theme);
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// Task type icons (top-left corner of the activity)
// ---------------------------------------------------------------------------

function taskIcon(type: string, bounds: Bounds, theme: Theme): string {
  const size = 14;
  const x = bounds.x + 5;
  const y = bounds.y + 5;
  const cx = x + size / 2;
  const cy = y + size / 2;
  const line = { stroke: theme.stroke, "stroke-width": 1.2, fill: "none" };

  switch (type) {
    case "UserTask":
      return [
        `<circle${attrs({ cx: round(cx), cy: round(y + size * 0.28), r: round(size * 0.22), ...line })} />`,
        `<path${attrs({
          d: `M ${round(x + size * 0.1)} ${round(y + size)} a ${round(size * 0.4)} ${round(size * 0.42)} 0 0 1 ${round(size * 0.8)} 0`,
          ...line,
        })} />`,
      ].join("");
    case "ServiceTask": {
      const teeth: string[] = [];
      for (let i = 0; i < 8; i += 1) {
        const angle = (i * Math.PI) / 4;
        const outer = { x: cx + Math.cos(angle) * size * 0.5, y: cy + Math.sin(angle) * size * 0.5 };
        const inner = { x: cx + Math.cos(angle) * size * 0.3, y: cy + Math.sin(angle) * size * 0.3 };
        teeth.push(
          `<line${attrs({
            x1: round(inner.x),
            y1: round(inner.y),
            x2: round(outer.x),
            y2: round(outer.y),
            stroke: theme.stroke,
            "stroke-width": 2,
            "stroke-linecap": "round",
          })} />`,
        );
      }
      return [
        ...teeth,
        `<circle${attrs({ cx: round(cx), cy: round(cy), r: round(size * 0.3), ...line, fill: theme.fill })} />`,
        `<circle${attrs({ cx: round(cx), cy: round(cy), r: round(size * 0.12), fill: theme.stroke, stroke: "none" })} />`,
      ].join("");
    }
    case "SendTask":
      return envelope(cx, cy, size, true, theme);
    case "ReceiveTask":
      return envelope(cx, cy, size, false, theme);
    case "ManualTask":
      return [
        `<rect${attrs({
          x: round(x),
          y: round(y + size * 0.35),
          width: round(size * 0.55),
          height: round(size * 0.5),
          rx: 2,
          ...line,
        })} />`,
        `<path${attrs({
          d: `M ${round(x + size * 0.55)} ${round(y + size * 0.45)} h ${round(size * 0.45)} M ${round(x + size * 0.55)} ${round(y + size * 0.62)} h ${round(size * 0.4)} M ${round(x + size * 0.55)} ${round(y + size * 0.79)} h ${round(size * 0.3)}`,
          ...line,
        })} />`,
      ].join("");
    case "ScriptTask":
      return [
        `<rect${attrs({ x: round(x + 1), y: round(y), width: round(size - 2), height: round(size), ...line })} />`,
        `<path${attrs({
          d: `M ${round(x + 3)} ${round(y + size * 0.3)} h ${round(size - 6)} M ${round(x + 3)} ${round(y + size * 0.55)} h ${round(size - 6)} M ${round(x + 3)} ${round(y + size * 0.8)} h ${round(size - 8)}`,
          ...line,
        })} />`,
      ].join("");
    case "BusinessRuleTask":
      return [
        `<rect${attrs({ x: round(x), y: round(y + 1), width: round(size), height: round(size - 2), ...line })} />`,
        `<path${attrs({
          d: `M ${round(x)} ${round(y + size * 0.35)} h ${round(size)} M ${round(x + size * 0.4)} ${round(y + size * 0.35)} v ${round(size * 0.55)}`,
          ...line,
        })} />`,
      ].join("");
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

function labelLines(name: string, maxWidth: number, theme: Theme): string[] {
  return wrapText(name, maxWidth, theme.fontSize);
}

function textBlock(
  lines: string[],
  cx: number,
  cy: number,
  theme: Theme,
  anchor: "middle" | "start" = "middle",
): string {
  if (lines.length === 0) return "";
  const top = cy - ((lines.length - 1) * theme.lineHeight) / 2;
  const spans = lines
    .map(
      (lineText, index) =>
        `<tspan${attrs({ x: round(cx), y: round(top + index * theme.lineHeight) })}>${escapeXml(lineText)}</tspan>`,
    )
    .join("");
  return `<text${attrs({
    "font-family": theme.fontFamily,
    "font-size": theme.fontSize,
    fill: theme.text,
    "text-anchor": anchor,
    "dominant-baseline": "central",
  })}>${spans}</text>`;
}

function drawActivity(shape: SceneShape, theme: Theme): string {
  const { bounds } = shape;
  const body = `<rect${attrs({
    x: round(bounds.x),
    y: round(bounds.y),
    width: round(bounds.width),
    height: round(bounds.height),
    rx: 10,
    ry: 10,
    fill: theme.fill,
    stroke: theme.stroke,
    "stroke-width": theme.strokeWidth,
  })} />`;

  const lines = labelLines(shape.name, bounds.width - 12, theme);
  const label = textBlock(lines, bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, theme);
  return body + taskIcon(shape.type, bounds, theme) + label;
}

function drawEvent(shape: SceneShape, theme: Theme): string {
  const { bounds } = shape;
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const r = Math.min(bounds.width, bounds.height) / 2;
  const isBoundary = shape.type === "BoundaryEvent";
  const isDouble =
    isBoundary || shape.type === "IntermediateCatchEvent" || shape.type === "IntermediateThrowEvent";
  const dashed = isBoundary && !shape.interrupting;
  const strokeWidth = shape.type === "EndEvent" ? theme.endEventStrokeWidth : theme.strokeWidth;

  const rings = [
    `<circle${attrs({
      cx: round(cx),
      cy: round(cy),
      r: round(r),
      fill: theme.fill,
      stroke: theme.stroke,
      "stroke-width": strokeWidth,
      "stroke-dasharray": dashed ? "4,3" : undefined,
    })} />`,
  ];
  if (isDouble) {
    rings.push(
      `<circle${attrs({
        cx: round(cx),
        cy: round(cy),
        r: round(r - 3.5),
        fill: "none",
        stroke: theme.stroke,
        "stroke-width": theme.strokeWidth,
        "stroke-dasharray": dashed ? "4,3" : undefined,
      })} />`,
    );
  }

  const filled = THROWING_EVENTS.has(shape.type);
  const glyph = eventGlyph(shape.eventDefinition, cx, cy, r * 0.85, filled, theme);
  return rings.join("") + glyph;
}

function drawGateway(shape: SceneShape, theme: Theme, alwaysShowExclusiveMarker: boolean): string {
  const { bounds } = shape;
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const halfW = bounds.width / 2;
  const halfH = bounds.height / 2;

  const diamond = `<polygon${attrs({
    points: points([
      { x: cx, y: cy - halfH },
      { x: cx + halfW, y: cy },
      { x: cx, y: cy + halfH },
      { x: cx - halfW, y: cy },
    ]),
    fill: theme.fill,
    stroke: theme.stroke,
    "stroke-width": theme.strokeWidth,
    "stroke-linejoin": "round",
  })} />`;

  let marker = "";
  const arm = Math.min(halfW, halfH) * 0.45;
  if (shape.type === "ExclusiveGateway" && (shape.markerVisible || alwaysShowExclusiveMarker)) {
    marker = `<path${attrs({
      d: `M ${round(cx - arm)} ${round(cy - arm)} L ${round(cx + arm)} ${round(cy + arm)} M ${round(cx + arm)} ${round(cy - arm)} L ${round(cx - arm)} ${round(cy + arm)}`,
      stroke: theme.stroke,
      "stroke-width": 3,
      "stroke-linecap": "round",
      fill: "none",
    })} />`;
  } else if (shape.type === "ParallelGateway") {
    const reach = Math.min(halfW, halfH) * 0.58;
    marker = `<path${attrs({
      d: `M ${round(cx - reach)} ${round(cy)} H ${round(cx + reach)} M ${round(cx)} ${round(cy - reach)} V ${round(cy + reach)}`,
      stroke: theme.stroke,
      "stroke-width": 3,
      "stroke-linecap": "round",
      fill: "none",
    })} />`;
  } else if (shape.type === "InclusiveGateway") {
    marker = `<circle${attrs({
      cx: round(cx),
      cy: round(cy),
      r: round(Math.min(halfW, halfH) * 0.52),
      fill: "none",
      stroke: theme.stroke,
      "stroke-width": 3,
    })} />`;
  } else if (shape.type === "EventBasedGateway") {
    const outer = Math.min(halfW, halfH) * 0.72;
    const pentagon: Point[] = [];
    for (let i = 0; i < 5; i += 1) {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      pentagon.push({ x: cx + Math.cos(angle) * outer * 0.55, y: cy + Math.sin(angle) * outer * 0.55 });
    }
    marker = [
      `<circle${attrs({ cx: round(cx), cy: round(cy), r: round(outer), fill: "none", stroke: theme.stroke, "stroke-width": 1.5 })} />`,
      `<circle${attrs({ cx: round(cx), cy: round(cy), r: round(outer - 3), fill: "none", stroke: theme.stroke, "stroke-width": 1.5 })} />`,
      `<polygon${attrs({ points: points(pentagon), fill: "none", stroke: theme.stroke, "stroke-width": 1.5, "stroke-linejoin": "round" })} />`,
    ].join("");
  }

  return diamond + marker;
}

function drawDataObject(shape: SceneShape, theme: Theme): string {
  const { bounds } = shape;
  const fold = Math.min(14, bounds.width * 0.38);
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;
  const body = `<path${attrs({
    d: `M ${round(bounds.x)} ${round(bounds.y)} H ${round(right - fold)} L ${round(right)} ${round(bounds.y + fold)} V ${round(bottom)} H ${round(bounds.x)} Z`,
    fill: theme.fill,
    stroke: theme.stroke,
    "stroke-width": theme.strokeWidth,
    "stroke-linejoin": "round",
  })} />`;
  const corner = `<path${attrs({
    d: `M ${round(right - fold)} ${round(bounds.y)} V ${round(bounds.y + fold)} H ${round(right)}`,
    fill: "none",
    stroke: theme.stroke,
    "stroke-width": theme.strokeWidth,
    "stroke-linejoin": "round",
  })} />`;
  return body + corner;
}

function drawDataStore(shape: SceneShape, theme: Theme): string {
  const { bounds } = shape;
  const rx = bounds.width / 2;
  const ry = Math.min(8, bounds.height * 0.16);
  const top = bounds.y + ry;
  const bottom = bounds.y + bounds.height - ry;
  const body = `<path${attrs({
    d: `M ${round(bounds.x)} ${round(top)} a ${round(rx)} ${round(ry)} 0 0 1 ${round(bounds.width)} 0 V ${round(bottom)} a ${round(rx)} ${round(ry)} 0 0 1 ${round(-bounds.width)} 0 Z`,
    fill: theme.fill,
    stroke: theme.stroke,
    "stroke-width": theme.strokeWidth,
  })} />`;
  const shelves = [1, 2]
    .map(
      (index) =>
        `<path${attrs({
          d: `M ${round(bounds.x)} ${round(top + index * ry * 0.9)} a ${round(rx)} ${round(ry)} 0 0 0 ${round(bounds.width)} 0`,
          fill: "none",
          stroke: theme.stroke,
          "stroke-width": 1.2,
        })} />`,
    )
    .join("");
  return body + shelves;
}

function drawTextAnnotation(shape: SceneShape, theme: Theme): string {
  const { bounds } = shape;
  const bracket = `<path${attrs({
    d: `M ${round(bounds.x + 10)} ${round(bounds.y)} H ${round(bounds.x)} V ${round(bounds.y + bounds.height)} H ${round(bounds.x + 10)}`,
    fill: "none",
    stroke: theme.stroke,
    "stroke-width": theme.strokeWidth,
  })} />`;

  // Wrap against the same content width the layout pass sized the box with, so
  // the text fills the bracket instead of spilling out of it.
  const lines = wrapText(shape.name, annotationContentWidth(bounds.width), ANNOTATION_FONT_SIZE);
  const label = textBlock(
    lines,
    bounds.x + 14,
    bounds.y + bounds.height / 2,
    { ...theme, fontSize: ANNOTATION_FONT_SIZE, lineHeight: ANNOTATION_LINE_HEIGHT },
    "start",
  );
  return bracket + label;
}

function drawContainer(shape: SceneShape, theme: Theme): string {
  const { bounds } = shape;
  const body = `<rect${attrs({
    x: round(bounds.x),
    y: round(bounds.y),
    width: round(bounds.width),
    height: round(bounds.height),
    fill: theme.fill,
    stroke: theme.stroke,
    "stroke-width": theme.strokeWidth,
  })} />`;

  if (shape.name.length === 0) return body;

  const header = `<line${attrs({
    x1: round(bounds.x + POOL_HEADER_WIDTH),
    y1: round(bounds.y),
    x2: round(bounds.x + POOL_HEADER_WIDTH),
    y2: round(bounds.y + bounds.height),
    stroke: theme.stroke,
    "stroke-width": theme.strokeWidth,
  })} />`;

  const cx = bounds.x + POOL_HEADER_WIDTH / 2;
  const cy = bounds.y + bounds.height / 2;
  const lines = labelLines(shape.name, bounds.height - 10, theme);
  const label = `<g${attrs({ transform: `rotate(-90 ${round(cx)} ${round(cy)})` })}>${textBlock(
    lines,
    cx,
    cy,
    theme,
  )}</g>`;
  return body + header + label;
}

/**
 * Horizontal span a label may occupy — the interior of the pool or lane the
 * element sits in.
 */
export interface LabelBand {
  left: number;
  right: number;
}

/**
 * Keep a centred label inside `band`.
 *
 * An event sitting at the left edge of a lane has a label far wider than its
 * 36 px circle, and centring it blindly pushes the text over the lane's name
 * strip. Slide it back instead. A label too wide for the band is pinned to the
 * left edge: overflowing into open canvas beats overwriting the lane header.
 */
function clampLabelCentre(centre: number, width: number, band: LabelBand | undefined): number {
  if (band === undefined) return centre;
  const half = width / 2;
  if (band.right - band.left <= width) return band.left + half;
  return Math.min(Math.max(centre, band.left + half), band.right - half);
}

function widestLine(lines: string[], theme: Theme): number {
  return lines.reduce((widest, line) => Math.max(widest, measureText(line, theme.fontSize)), 0);
}

/** Label placed outside the shape: uses the DI label box when the layout set one. */
function externalLabel(shape: SceneShape, theme: Theme, band?: LabelBand): string {
  if (shape.name.length === 0) return "";
  const box = shape.labelBounds;
  if (box !== undefined) {
    const lines = labelLines(shape.name, Math.max(box.width, 40), theme);
    const centre = clampLabelCentre(box.x + box.width / 2, widestLine(lines, theme), band);
    return textBlock(lines, centre, box.y + box.height / 2, theme);
  }
  const maxWidth = Math.max(shape.bounds.width * 2.6, 90);
  const lines = labelLines(shape.name, maxWidth, theme);
  const centre = clampLabelCentre(
    shape.bounds.x + shape.bounds.width / 2,
    widestLine(lines, theme),
    band,
  );
  const top = shape.bounds.y + shape.bounds.height + 6 + theme.lineHeight / 2;
  return textBlock(lines, centre, top + ((lines.length - 1) * theme.lineHeight) / 2, theme);
}

export interface DrawOptions {
  theme: Theme;
  /**
   * Draw the `X` on exclusive gateways even when the DI omits
   * `isMarkerVisible`. BPMN leaves the marker optional, but a bare diamond is
   * ambiguous next to a parallel gateway, so it is on by default.
   */
  alwaysShowExclusiveMarker: boolean;
}

export function drawShape(shape: SceneShape, options: DrawOptions): string {
  const { theme } = options;
  const body = ((): string => {
    if (TASK_TYPES.has(shape.type)) return drawActivity(shape, theme);
    if (EVENT_TYPES.has(shape.type)) return drawEvent(shape, theme);
    if (GATEWAY_TYPES.has(shape.type)) {
      return drawGateway(shape, theme, options.alwaysShowExclusiveMarker);
    }
    if (shape.type === "Participant" || shape.type === "Lane") return drawContainer(shape, theme);
    if (shape.type === "DataObjectReference") return drawDataObject(shape, theme);
    if (shape.type === "DataStoreReference") return drawDataStore(shape, theme);
    if (shape.type === "TextAnnotation") return drawTextAnnotation(shape, theme);
    return drawActivity(shape, theme);
  })();

  // Group and tag every element so the SVG stays inspectable and restylable:
  // `.bpmn-shape` plus the BPMN type, and the element id the BPMN file uses.
  return `<g${attrs({
    class: `bpmn-shape bpmn-${shape.type}`,
    "data-element-id": shape.id.length > 0 ? shape.id : undefined,
  })}>${body}</g>`;
}

// ---------------------------------------------------------------------------
// Edges
// ---------------------------------------------------------------------------

/** Types whose label sits outside the shape and is drawn in the label pass. */
const EXTERNALLY_LABELLED = new Set([
  ...EVENT_TYPES,
  ...GATEWAY_TYPES,
  "DataObjectReference",
  "DataStoreReference",
]);

/**
 * Label for a shape that carries it outside its own outline.
 *
 * Drawn after every shape so a neighbouring task cannot paint over it.
 */
export function drawShapeLabel(shape: SceneShape, theme: Theme, band?: LabelBand): string {
  if (!EXTERNALLY_LABELLED.has(shape.type)) return "";
  const label = externalLabel(shape, theme, band);
  if (label.length === 0) return "";
  return `<g${attrs({
    class: "bpmn-shape-label",
    "data-element-id": shape.id.length > 0 ? shape.id : undefined,
  })}>${label}</g>`;
}

export function drawEdge(edge: SceneEdge, theme: Theme): string {
  const isMessage = edge.type === "MessageFlow";
  const isAssociation = edge.type === "Association" || edge.type === "DataInputAssociation" || edge.type === "DataOutputAssociation";

  const line = `<polyline${attrs({
    points: points(edge.waypoints),
    fill: "none",
    stroke: theme.stroke,
    "stroke-width": isAssociation ? 1.5 : theme.strokeWidth,
    "stroke-linejoin": "round",
    "stroke-dasharray": isMessage ? "8,6" : isAssociation ? "1,5" : undefined,
    "stroke-linecap": isAssociation ? "round" : undefined,
    "marker-end": isMessage
      ? "url(#bpmn-message-end)"
      : isAssociation
        ? undefined
        : "url(#bpmn-sequence-end)",
    "marker-start": isMessage ? "url(#bpmn-message-start)" : undefined,
  })} />`;

  return `<g${attrs({
    class: `bpmn-edge bpmn-${edge.type}`,
    "data-element-id": edge.id.length > 0 ? edge.id : undefined,
  })}>${line}</g>`;
}

/** Condition or message label of an edge, drawn on top of everything else. */
export function drawEdgeLabel(edge: SceneEdge, theme: Theme): string {
  if (edge.name.length === 0) return "";

  const box = edge.labelBounds;
  const lines = labelLines(edge.name, box !== undefined ? Math.max(box.width, 40) : 110, theme);
  const anchor =
    box !== undefined
      ? { x: box.x + box.width / 2, y: box.y + box.height / 2 }
      : (() => {
          const mid = edge.waypoints[Math.floor(edge.waypoints.length / 2)];
          return { x: mid.x, y: mid.y - theme.lineHeight };
        })();

  return `<g${attrs({ class: "bpmn-edge-label" })}>${textBlock(lines, anchor.x, anchor.y, theme)}</g>`;
}

/** Arrowheads and the message-flow source dot, in user space so they never scale oddly. */
export function markerDefs(theme: Theme): string {
  return `<defs>
<marker id="bpmn-sequence-end" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto">
<path d="M 1 1 L 11 6 L 1 11 z" fill="${theme.stroke}" stroke="${theme.stroke}" stroke-width="1" stroke-linejoin="round" />
</marker>
<marker id="bpmn-message-end" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto">
<path d="M 1 1 L 11 6 L 1 11" fill="${theme.fill}" stroke="${theme.stroke}" stroke-width="1.5" stroke-linejoin="round" />
</marker>
<marker id="bpmn-message-start" viewBox="0 0 12 12" refX="1" refY="6" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto">
<circle cx="6" cy="6" r="4" fill="${theme.fill}" stroke="${theme.stroke}" stroke-width="1.5" />
</marker>
</defs>`;
}

export { measureText };
