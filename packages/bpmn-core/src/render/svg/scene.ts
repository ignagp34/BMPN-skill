import BpmnModdle from "bpmn-moddle";

/**
 * Flattens BPMN diagram interchange into a draw list.
 *
 * The layout pipeline already decided every coordinate; this module only reads
 * the plane and normalizes what the renderer needs to pick a glyph: element
 * type, event definition, boundary interruption, gateway kind, label boxes.
 */

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export type EventDefinition =
  | "none"
  | "message"
  | "timer"
  | "error"
  | "escalation"
  | "signal"
  | "link"
  | "terminate";

export interface SceneShape {
  id: string;
  /** BPMN type without the namespace prefix, e.g. `UserTask`, `StartEvent`. */
  type: string;
  name: string;
  bounds: Bounds;
  labelBounds?: Bounds;
  eventDefinition: EventDefinition;
  /** Boundary events only: false for a non-interrupting (dashed) boundary. */
  interrupting: boolean;
  /** Participants and lanes only. */
  isHorizontal: boolean;
  /** Exclusive gateways only: whether the DI asks for the `X` marker. */
  markerVisible: boolean;
}

export interface SceneEdge {
  id: string;
  /** BPMN type without the namespace prefix, e.g. `SequenceFlow`. */
  type: string;
  name: string;
  waypoints: Point[];
  labelBounds?: Bounds;
}

export interface Scene {
  shapes: SceneShape[];
  edges: SceneEdge[];
}

const EVENT_DEFINITION_BY_TYPE: Record<string, EventDefinition> = {
  "bpmn:MessageEventDefinition": "message",
  "bpmn:TimerEventDefinition": "timer",
  "bpmn:ErrorEventDefinition": "error",
  "bpmn:EscalationEventDefinition": "escalation",
  "bpmn:SignalEventDefinition": "signal",
  "bpmn:LinkEventDefinition": "link",
  "bpmn:TerminateEventDefinition": "terminate",
};

/** Containers are drawn first so flow elements land on top of them. */
const CONTAINER_TYPES = new Set(["Participant", "Lane"]);

type ModdleElement = Record<string, any>;

function stripPrefix(type: string | undefined): string {
  if (type === undefined) return "";
  const colon = type.indexOf(":");
  return colon === -1 ? type : type.slice(colon + 1);
}

function toBounds(raw: ModdleElement | undefined): Bounds | undefined {
  if (raw === undefined) return undefined;
  const { x, y, width, height } = raw;
  if ([x, y, width, height].some((value) => typeof value !== "number")) return undefined;
  return { x, y, width, height };
}

/** Visible label of an element: `name` for most types, `text` for annotations. */
function readLabel(element: ModdleElement): string {
  if (element.$type === "bpmn:TextAnnotation") {
    return typeof element.text === "string" ? element.text : "";
  }
  return typeof element.name === "string" ? element.name : "";
}

function readEventDefinition(element: ModdleElement | undefined): EventDefinition {
  const definitions: ModdleElement[] = element?.eventDefinitions ?? [];
  for (const definition of definitions) {
    const mapped = EVENT_DEFINITION_BY_TYPE[definition.$type as string];
    if (mapped !== undefined) return mapped;
  }
  return "none";
}

/**
 * Read the first BPMN diagram of `layoutXml` into a draw list.
 *
 * Throws when the XML carries no diagram interchange — callers must run the
 * layout pipeline first.
 */
export async function buildScene(layoutXml: string): Promise<Scene> {
  const moddle = new BpmnModdle();
  const { rootElement } = await moddle.fromXML(layoutXml);
  const definitions = rootElement as ModdleElement;

  const plane = definitions.diagrams?.[0]?.plane;
  if (plane === undefined) {
    throw new Error("BPMN XML carries no diagram interchange — run the layout pipeline first.");
  }

  const shapes: SceneShape[] = [];
  const edges: SceneEdge[] = [];
  const planeElements: ModdleElement[] = Array.isArray(plane.planeElement) ? plane.planeElement : [];

  for (const element of planeElements) {
    const target = element.bpmnElement as ModdleElement | undefined;
    if (target === undefined) continue;

    if (element.$type === "bpmndi:BPMNShape") {
      const bounds = toBounds(element.bounds);
      if (bounds === undefined) continue;
      shapes.push({
        id: target.id ?? element.id ?? "",
        type: stripPrefix(target.$type),
        // A text annotation carries its content in `bpmn:text`, not `name`.
        name: readLabel(target),
        bounds,
        labelBounds: toBounds(element.label?.bounds),
        eventDefinition: readEventDefinition(target),
        interrupting: target.cancelActivity !== false,
        isHorizontal: element.isHorizontal !== false,
        markerVisible: element.isMarkerVisible === true,
      });
      continue;
    }

    if (element.$type === "bpmndi:BPMNEdge") {
      const waypoints: Point[] = (element.waypoint ?? [])
        .filter((point: ModdleElement) => typeof point?.x === "number" && typeof point?.y === "number")
        .map((point: ModdleElement) => ({ x: point.x, y: point.y }));
      if (waypoints.length < 2) continue;
      edges.push({
        id: target.id ?? element.id ?? "",
        type: stripPrefix(target.$type),
        name: typeof target.name === "string" ? target.name : "",
        waypoints,
        labelBounds: toBounds(element.label?.bounds),
      });
    }
  }

  // Pools and lanes are backdrops. Draw the largest container first so nested
  // lanes stay visible inside their participant.
  shapes.sort((a, b) => {
    const aContainer = CONTAINER_TYPES.has(a.type) ? 0 : 1;
    const bContainer = CONTAINER_TYPES.has(b.type) ? 0 : 1;
    if (aContainer !== bContainer) return aContainer - bContainer;
    if (aContainer === 1) return 0;
    return b.bounds.width * b.bounds.height - a.bounds.width * a.bounds.height;
  });

  return { shapes, edges };
}

/** Bounding box covering every shape, waypoint and label in the scene. */
export function sceneBounds(scene: Scene): Bounds {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  const include = (bounds: Bounds): void => {
    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    maxY = Math.max(maxY, bounds.y + bounds.height);
  };

  for (const shape of scene.shapes) {
    include(shape.bounds);
    if (shape.labelBounds !== undefined) include(shape.labelBounds);
  }
  for (const edge of scene.edges) {
    for (const point of edge.waypoints) {
      include({ x: point.x, y: point.y, width: 0, height: 0 });
    }
    if (edge.labelBounds !== undefined) include(edge.labelBounds);
  }

  if (!Number.isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
