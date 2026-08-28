import { describe, expect, it } from "vitest";
import { layoutProcess } from "bpmn-auto-layout";

import { parseDsl, emitBpmnXml } from "../../src/dsl/index.js";
import { sanitizeForLayout } from "../../src/render/sanitize.js";

/**
 * Regression for the SYN013 family (all 11 `render_error` cases in the thesis
 * corpus): a trace ending on an interrupting boundary event produced a boundary
 * with no outgoing flow, and bpmn-auto-layout 0.5.0's attachersHandler crashed
 * with "Cannot read properties of undefined (reading 'reverse')". The semantic
 * pass now completes such boundaries with a synthesized end event, so layout
 * succeeds.
 */
describe("boundary-event layout regression (SYN013 pattern)", () => {
  it("lays out a trace ending in an interrupting boundary without crashing", async () => {
    const dsl = [
      "Support Agent: Investigate issue",
      "Work on resolution",
      "(deadline SLA deadline)",
    ].join("\n");

    const { model } = parseDsl(dsl);
    const semantic = emitBpmnXml(model);
    const cleaned = await sanitizeForLayout(semantic);

    await expect(layoutProcess(cleaned)).resolves.toBeTypeOf("string");
  });

  it("also handles a multi-lane escalation + deadline shape (closer to SYN013)", async () => {
    const dsl = [
      "Support Agent: Work on resolution",
      "(deadline SLA deadline)",
      "(escalate SLA breach to team lead)",
      "Team Lead: Review ticket",
      "Support Agent: Close ticket",
    ].join("\n");

    const { model } = parseDsl(dsl);
    const cleaned = await sanitizeForLayout(emitBpmnXml(model));

    await expect(layoutProcess(cleaned)).resolves.toBeTypeOf("string");
  });
});
