import type { EventSubtype, FlowNode, ResolvedModel, TaskType } from "../dsl/ast.js";
import { slug } from "../dsl/semantic.js";
import { el, escape, selfEl, text } from "./xml.js";

/**
 * Spec §6.3 — task-type keywords promote a generic task to a typed BPMN task.
 * The mapping below is the complete set Sketch Miner supports today; adding a
 * new keyword means (1) extending TaskType in ast.ts, (2) adding it to
 * TASK_TYPE_KEYWORDS in lexer.ts, and (3) registering its BPMN tag here.
 */
const TASK_TAG_BY_TYPE: Record<TaskType, string> = {
  user: "bpmn:userTask",
  service: "bpmn:serviceTask",
  rule: "bpmn:businessRuleTask",
  manual: "bpmn:manualTask",
  receive: "bpmn:receiveTask",
  send: "bpmn:sendTask",
  script: "bpmn:scriptTask",
};

const NS = {
  bpmn: "http://www.omg.org/spec/BPMN/20100524/MODEL",
  bpmndi: "http://www.omg.org/spec/BPMN/20100524/DI",
  dc: "http://www.omg.org/spec/DD/20100524/DC",
  di: "http://www.omg.org/spec/DD/20100524/DI",
  xsi: "http://www.w3.org/2001/XMLSchema-instance",
};

const THROW_INTERMEDIATE: ReadonlySet<EventSubtype> = new Set<EventSubtype>([
  "send",
  "escalate",
  "escalated",
  "publish",
  "notify",
  "link",
]);

type Participant = {
  id: string;
  name: string;
  processId: string;
  poolNames: string[];
};

export function emitBpmnXml(model: ResolvedModel): string {
  const fixed = fixUpEmptyPools(model);
  const participants = groupPools(fixed);

  // A DSL that never names a pool gets one invented for it (see
  // Program.syntheticPool). Serializing that as a collaboration would put a
  // participant and a lane called "Pool_1" on the diagram — two header strips
  // carrying a name the author never wrote. Emit a plain process instead, which
  // is what a single-participant process without swimlanes actually is.
  const plainProcess =
    fixed.syntheticPool === true && participants.length === 1 && fixed.messageFlows.length === 0;

  if (plainProcess) {
    const root = el(
      "bpmn:definitions",
      {
        "xmlns:bpmn": NS.bpmn,
        "xmlns:bpmndi": NS.bpmndi,
        "xmlns:dc": NS.dc,
        "xmlns:di": NS.di,
        "xmlns:xsi": NS.xsi,
        id: "Definitions_1",
        targetNamespace: "http://bpmn.io/schema/bpmn",
      },
      emitProcess(participants[0], fixed, { omitLaneSet: true }),
    );
    return `<?xml version="1.0" encoding="UTF-8"?>
${root}
`;
  }

  const collaborationBody: string[] = [];
  for (const p of participants) {
    collaborationBody.push(
      selfEl("bpmn:participant", {
        id: p.id,
        name: p.name,
        processRef: p.processId,
      }),
    );
  }
  for (const mf of fixed.messageFlows) {
    collaborationBody.push(
      selfEl("bpmn:messageFlow", {
        id: mf.id,
        name: mf.label || undefined,
        sourceRef: mf.sourceId,
        targetRef: mf.targetId,
      }),
    );
  }

  const processes: string[] = [];
  for (const p of participants) {
    processes.push(emitProcess(p, fixed));
  }

  const body = [
    el("bpmn:collaboration", { id: "Collaboration_1" }, collaborationBody.join("")),
    ...processes,
  ].join("");

  const root = el(
    "bpmn:definitions",
    {
      "xmlns:bpmn": NS.bpmn,
      "xmlns:bpmndi": NS.bpmndi,
      "xmlns:dc": NS.dc,
      "xmlns:di": NS.di,
      "xmlns:xsi": NS.xsi,
      id: "Definitions_1",
      targetNamespace: "http://bpmn.io/schema/bpmn",
    },
    body,
  );

  return `<?xml version="1.0" encoding="UTF-8"?>\n${root}\n`;
}

/** Assign every FlowNode a non-empty pool, walking sequence flows until no node is empty. */
function fixUpEmptyPools(model: ResolvedModel): ResolvedModel {
  const nodes = new Map<string, FlowNode>();
  for (const [id, n] of model.flowNodes) nodes.set(id, { ...n });

  // V5 pool-name-as-lane collision: a node whose lane is a declared PARTICIPANT
  // name that is not itself one of that pool's lanes came from a stand-alone
  // `PoolName:` default used for pool-level events (typically inbound message
  // receives). There is no real lane to hold it, so clear the lane and let the
  // propagation below adopt the neighbour's lane (e.g. a `(receive …)` adopts
  // the lane of the task it feeds). This avoids a redundant lane named after the
  // pool. (The DSL ambiguity is still surfaced via POOL_MAP_NAME_COLLISION.)
  const declared = model.declaredPools ?? [];
  const collisionLaneNames = new Set<string>();
  if (declared.length > 0) {
    const laneNames = new Set<string>();
    for (const p of declared) for (const lane of p.lanes) laneNames.add(lane);
    for (const p of declared) if (!laneNames.has(p.name)) collisionLaneNames.add(p.name);
    for (const n of nodes.values()) {
      if (n.pool && collisionLaneNames.has(n.pool)) n.pool = "";
    }
  }

  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const f of model.flows) {
    (outgoing.get(f.sourceId) ?? outgoing.set(f.sourceId, []).get(f.sourceId)!).push(f.targetId);
    (incoming.get(f.targetId) ?? incoming.set(f.targetId, []).get(f.targetId)!).push(f.sourceId);
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const n of nodes.values()) {
      if (n.pool) continue;
      const preds = incoming.get(n.id) ?? [];
      for (const pid of preds) {
        const p = nodes.get(pid);
        if (p?.pool) {
          n.pool = p.pool;
          changed = true;
          break;
        }
      }
      if (n.pool) continue;
      const succs = outgoing.get(n.id) ?? [];
      for (const sid of succs) {
        const s = nodes.get(sid);
        if (s?.pool) {
          n.pool = s.pool;
          changed = true;
          break;
        }
      }
    }
  }

  // Boundary events: align with their attached task.
  for (const n of nodes.values()) {
    if (n.kind === "boundaryEvent" && n.attachedTo) {
      const attached = nodes.get(n.attachedTo);
      if (attached?.pool) n.pool = attached.pool;
    }
  }

  // Last-resort fallback to first real (non-collision) pool.
  const fallback = model.pools.find((p) => !collisionLaneNames.has(p.name))?.name ?? "";
  for (const n of nodes.values()) {
    if (!n.pool) n.pool = fallback;
  }

  // Rebuild pool index with the fixed-up pools, dropping collision lane names
  // (declared participant names that aren't real lanes). Their nodes were
  // reassigned to neighbour lanes above, so keeping the name would emit a stray
  // empty lane and an empty duplicate participant.
  const pools = model.pools
    .filter((p) => !collisionLaneNames.has(p.name))
    .map((p) => ({ name: p.name, nodeIds: [] as string[] }));
  for (const n of nodes.values()) {
    const target = pools.find((p) => p.name === n.pool);
    if (target) target.nodeIds.push(n.id);
    else if (pools.length > 0) pools[0].nodeIds.push(n.id);
  }

  return { ...model, flowNodes: nodes, pools };
}

/** Union-find on pool names: connect any two pools that share a sequence flow. */
function groupPools(model: ResolvedModel): Participant[] {
  const poolNames = model.pools.map((p) => p.name);
  if (poolNames.length === 0) {
    return [
      {
        id: "Participant_1",
        name: "Process",
        processId: "Process_1",
        poolNames: [],
      },
    ];
  }

  const parent = new Map<string, string>();
  for (const name of poolNames) parent.set(name, name);
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    let cur = x;
    while (parent.get(cur) !== r) {
      const next = parent.get(cur)!;
      parent.set(cur, r);
      cur = next;
    }
    return r;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  // V5 seed: lanes listed under the same declared pool always share a
  // participant (the declaration is authoritative for grouping). The
  // connectivity union below then only pulls in *unlisted* lanes; cross-pool
  // control flows were already pruned in the semantic pass, so they cannot
  // merge two declared-separate pools here.
  const declaredPools = model.declaredPools ?? [];
  for (const dp of declaredPools) {
    const present = dp.lanes.filter((lane) => parent.has(lane));
    for (let i = 1; i < present.length; i++) union(present[0], present[i]);
  }

  for (const f of model.flows) {
    const sp = model.flowNodes.get(f.sourceId)?.pool;
    const tp = model.flowNodes.get(f.targetId)?.pool;
    if (sp && tp && sp !== tp && parent.has(sp) && parent.has(tp)) union(sp, tp);
  }

  // Declared-pool naming: laneName → declared pool name, and declared lane order.
  const laneToDeclared = new Map<string, string>();
  const declaredLaneOrder = new Map<string, string[]>();
  for (const dp of declaredPools) {
    if (!declaredLaneOrder.has(dp.name)) declaredLaneOrder.set(dp.name, []);
    const order = declaredLaneOrder.get(dp.name)!;
    for (const lane of dp.lanes) {
      if (!laneToDeclared.has(lane)) laneToDeclared.set(lane, dp.name);
      if (!order.includes(lane)) order.push(lane);
    }
  }

  // Group pools by root, preserving DSL declaration order.
  const groups = new Map<string, string[]>();
  for (const name of poolNames) {
    const r = find(name);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(name);
  }

  // Walk poolNames again to keep deterministic participant order.
  const seen = new Set<string>();
  const usedSlugs = new Set<string>();
  const participants: Participant[] = [];
  let counter = 0;
  for (const name of poolNames) {
    const r = find(name);
    if (seen.has(r)) continue;
    seen.add(r);
    const members = groups.get(r)!;

    // If any member lane belongs to a declared pool, that declaration supplies
    // the participant name and the lane order (declared lanes first, in declared
    // order; any connectivity-pulled extras after). Otherwise fall back to the
    // first member (today's behaviour).
    let participantName = members[0];
    let orderedMembers = members;
    const declaredName = members.map((m) => laneToDeclared.get(m)).find((d) => d !== undefined);
    if (declaredName) {
      participantName = declaredName;
      const declaredLanes = (declaredLaneOrder.get(declaredName) ?? []).filter((lane) =>
        members.includes(lane),
      );
      const extras = members.filter((m) => !declaredLanes.includes(m));
      orderedMembers = [...declaredLanes, ...extras];
    }

    counter++;
    let idSlug = slug(participantName) || `p${counter}`;
    // Guard against id collisions (e.g. a declared pool name that slugs to the
    // same value as another participant's) — duplicate ids break BPMN import.
    if (usedSlugs.has(idSlug)) {
      let n = 2;
      while (usedSlugs.has(`${idSlug}_${n}`)) n++;
      idSlug = `${idSlug}_${n}`;
    }
    usedSlugs.add(idSlug);
    participants.push({
      id: `Participant_${idSlug}`,
      name: participantName,
      processId: `Process_${idSlug}`,
      poolNames: orderedMembers,
    });
  }
  return participants;
}

function emitProcess(
  p: Participant,
  model: ResolvedModel,
  opts: { omitLaneSet?: boolean } = {},
): string {
  const memberPools = new Set(p.poolNames);
  const nodesInProcess: FlowNode[] = [];
  for (const n of model.flowNodes.values()) {
    if (memberPools.has(n.pool)) nodesInProcess.push(n);
  }

  // Lane set: one lane per pool, with flowNodeRef children for true flow nodes only
  // (BPMN 2.0: data refs are flowElements, not flowNodes — excluded).
  const laneRefsByPool = new Map<string, string[]>();
  for (const name of p.poolNames) laneRefsByPool.set(name, []);
  for (const n of nodesInProcess) {
    if (n.kind === "dataObject" || n.kind === "dataStore") continue;
    const refs = laneRefsByPool.get(n.pool);
    if (refs) refs.push(n.id);
  }
  const lanes: string[] = [];
  for (const poolName of p.poolNames) {
    const refs = laneRefsByPool.get(poolName) ?? [];
    const refEls = refs.map((id) => el("bpmn:flowNodeRef", undefined, escape(id)));
    lanes.push(
      el(
        "bpmn:lane",
        { id: `Lane_${slug(poolName)}`, name: poolName },
        refEls.join(""),
      ),
    );
  }
  const laneSet = el(
    "bpmn:laneSet",
    { id: `LaneSet_${slug(p.name)}` },
    lanes.join(""),
  );

  // Precompute incoming/outgoing flow IDs per node — BPMN requires these as child
  // elements on every flow node for auto-layout to traverse the graph.
  const incomingByNode = new Map<string, string[]>();
  const outgoingByNode = new Map<string, string[]>();
  for (const f of model.flows) {
    (outgoingByNode.get(f.sourceId) ?? outgoingByNode.set(f.sourceId, []).get(f.sourceId)!).push(f.id);
    (incomingByNode.get(f.targetId) ?? incomingByNode.set(f.targetId, []).get(f.targetId)!).push(f.id);
  }

  // Element bodies.
  const nodeXmls = nodesInProcess.map((n) =>
    emitFlowNode(n, incomingByNode.get(n.id) ?? [], outgoingByNode.get(n.id) ?? []),
  );

  // Sequence flows whose source is in this process.
  const flowsInProcess = model.flows.filter((f) => {
    const src = model.flowNodes.get(f.sourceId);
    return src ? memberPools.has(src.pool) : false;
  });
  const flowXmls = flowsInProcess.map((f) =>
    selfEl("bpmn:sequenceFlow", {
      id: f.id,
      name: f.conditionLabel || undefined,
      sourceRef: f.sourceId,
      targetRef: f.targetId,
    }),
  );

  // Text annotations + associations: one per (node, annotation string).
  // Plus: one association per data ref → its attached task.
  const annotationXmls: string[] = [];
  const associationXmls: string[] = [];
  let annoCounter = 0;
  let assocCounter = 0;
  for (const n of nodesInProcess) {
    for (const a of n.annotations) {
      annoCounter++;
      const annoId = `TextAnnotation_${slug(p.name) || "p"}_${annoCounter}`;
      annotationXmls.push(
        el(
          "bpmn:textAnnotation",
          { id: annoId },
          el("bpmn:text", undefined, text(a)),
        ),
      );
      assocCounter++;
      const assocId = `Association_${slug(p.name) || "p"}_${assocCounter}`;
      associationXmls.push(
        selfEl("bpmn:association", {
          id: assocId,
          sourceRef: n.id,
          targetRef: annoId,
        }),
      );
    }
  }
  for (const n of nodesInProcess) {
    if (n.kind !== "dataObject" && n.kind !== "dataStore") continue;
    // Output association: producing task → data node.
    if (n.attachedTo) {
      assocCounter++;
      associationXmls.push(
        selfEl("bpmn:association", {
          id: `Association_${slug(p.name) || "p"}_${assocCounter}`,
          sourceRef: n.attachedTo,
          targetRef: n.id,
        }),
      );
    }
    // Input association: data node → consuming task. Spec §11.1 — a data
    // object between two tasks is canonically both an output of the upstream
    // task AND an input to the downstream one.
    if (n.attachedInputOf && n.attachedInputOf !== n.attachedTo) {
      assocCounter++;
      associationXmls.push(
        selfEl("bpmn:association", {
          id: `Association_${slug(p.name) || "p"}_${assocCounter}`,
          sourceRef: n.id,
          targetRef: n.attachedInputOf,
        }),
      );
    }
  }

  const body = [
    ...(opts.omitLaneSet === true ? [] : [laneSet]),
    ...nodeXmls,
    ...flowXmls,
    ...annotationXmls,
    ...associationXmls,
  ].join("");

  return el(
    "bpmn:process",
    { id: p.processId, isExecutable: "false" },
    body,
  );
}

function flowRefs(incoming: string[], outgoing: string[]): string {
  const parts: string[] = [];
  for (const id of incoming) parts.push(el("bpmn:incoming", undefined, escape(id)));
  for (const id of outgoing) parts.push(el("bpmn:outgoing", undefined, escape(id)));
  return parts.join("");
}

function emitFlowNode(n: FlowNode, incoming: string[], outgoing: string[]): string {
  const refs = flowRefs(incoming, outgoing);
  switch (n.kind) {
    case "task": {
      const tag = n.taskType ? TASK_TAG_BY_TYPE[n.taskType] : "bpmn:task";
      return el(tag, { id: n.id, name: n.label || undefined }, refs);
    }
    case "startEvent":
      return emitEvent("bpmn:startEvent", n, refs);
    case "endEvent":
      return emitEvent("bpmn:endEvent", n, refs);
    case "intermediateEvent": {
      const isThrow = n.eventType ? THROW_INTERMEDIATE.has(n.eventType) : false;
      return emitEvent(isThrow ? "bpmn:intermediateThrowEvent" : "bpmn:intermediateCatchEvent", n, refs);
    }
    case "boundaryEvent":
      return emitEvent("bpmn:boundaryEvent", n, refs);
    case "exclusiveGateway":
      return el("bpmn:exclusiveGateway", { id: n.id, name: n.label || undefined }, refs);
    case "parallelGateway":
      return el("bpmn:parallelGateway", { id: n.id, name: n.label || undefined }, refs);
    case "eventBasedGateway":
      return el("bpmn:eventBasedGateway", { id: n.id, name: n.label || undefined }, refs);
    case "dataObject":
      return el("bpmn:dataObjectReference", { id: n.id, name: n.label || undefined });
    case "dataStore":
      return el("bpmn:dataStoreReference", { id: n.id, name: n.label || undefined });
  }
}

function emitEvent(tag: string, n: FlowNode, refs: string): string {
  const attrs: Record<string, string | undefined> = {
    id: n.id,
    name: n.label || undefined,
  };
  if (tag === "bpmn:boundaryEvent") {
    if (n.attachedTo) attrs.attachedToRef = n.attachedTo;
    attrs.cancelActivity = n.interrupting === false ? "false" : "true";
  }
  const def = eventDefinitionFor(n.eventType);
  return el(tag, attrs, refs + def);
}

function eventDefinitionFor(et: EventSubtype | undefined): string {
  if (!et) return "";
  switch (et) {
    case "timer":
    case "deadline":
      return selfEl("bpmn:timerEventDefinition");
    case "message":
    case "received":
    case "receive":
    case "send":
      return selfEl("bpmn:messageEventDefinition");
    case "signal":
      return selfEl("bpmn:signalEventDefinition");
    case "error":
    case "exception":
      return selfEl("bpmn:errorEventDefinition");
    case "escalate":
    case "escalated":
      return selfEl("bpmn:escalationEventDefinition");
    case "terminate":
      return selfEl("bpmn:terminateEventDefinition");
    case "link":
      return selfEl("bpmn:linkEventDefinition");
    default:
      return "";
  }
}

