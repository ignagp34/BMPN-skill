import { describe, expect, it } from "vitest";
import BpmnModdle from "bpmn-moddle";
import { parseDsl } from "../../src/dsl/index.js";
import { emitBpmnXml } from "../../src/bpmn/emit.js";

/**
 * Pool-scope regressions exposed by a large real-world Spanish collaboration
 * (a waste-sorting plant, `fixtures/planta-residuos.dsl`):
 *
 *  1. A stand-alone `PoolName:` default pool must NOT carry across a blank line.
 *     It did, so each trace's unprefixed `(start …)` inherited the previous
 *     paragraph's default lane and a spurious cross-lane edge fused unrelated
 *     pools (e.g. "Generadores de residuos" swallowed the whole plant).
 *  2. When the author uses a declared POOL name as a stand-alone default for
 *     pool-level events (typically inbound `(receive …)`), those events have no
 *     real lane. They must fold into a neighbouring lane rather than producing a
 *     redundant lane named after the pool (and a stray empty duplicate pool).
 */

async function participants(dsl: string): Promise<Array<{ name: string; lanes: string[] }>> {
  const { model } = parseDsl(dsl);
  const xml = emitBpmnXml(model);
  const moddle = new BpmnModdle();
  const { rootElement } = (await moddle.fromXML(xml)) as { rootElement: any };
  const collab = rootElement.rootElements.find((r: any) => r.$type === "bpmn:Collaboration");
  const procById = new Map<string, any>();
  for (const r of rootElement.rootElements) if (r.$type === "bpmn:Process") procById.set(r.id, r);
  return (collab.participants ?? []).map((p: any) => {
    const proc = procById.get(p.processRef?.id);
    const lanes: string[] = [];
    for (const ls of proc?.laneSets ?? []) for (const ln of ls.lanes ?? []) lanes.push(ln.name);
    return { name: p.name, lanes };
  });
}

describe("default pool scope resets at blank lines", () => {
  it("an unprefixed (start) in a new paragraph does not inherit a prior standalone default pool", async () => {
    const dsl = [
      "Planta:",
      "(receive Carga)",
      "Recepción: Registrar entrada",
      "",
      "(start Inicio)",
      "Generador: Separar",
      "",
      "== pools ==",
      "Generadores -> Generador",
      "Clasificación -> Recepción",
    ].join("\n");
    const parts = await participants(dsl);
    const gen = parts.find((p) => p.lanes.includes("Generador"));
    expect(gen?.name).toBe("Generadores");
    // The (start) must not have dragged Generador into the Recepción pool.
    expect(gen?.lanes).not.toContain("Recepción");
  });
});

describe("pool-name-as-lane collision", () => {
  it("folds pool-level events into a real lane (no duplicate pool, no pool-named lane)", async () => {
    const dsl = [
      "Planta:",
      "(receive Carga)",
      "Recepción: Registrar",
      "Calidad: Controlar",
      "",
      "== pools ==",
      "Planta -> Recepción; Calidad",
    ].join("\n");
    const parts = await participants(dsl);
    const planta = parts.filter((p) => p.name === "Planta");
    expect(planta).toHaveLength(1); // not a stray empty duplicate
    expect(planta[0].lanes).toEqual(["Recepción", "Calidad"]); // no redundant "Planta" lane
  });
});
