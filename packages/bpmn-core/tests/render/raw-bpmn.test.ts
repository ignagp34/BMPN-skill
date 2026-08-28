import { describe, expect, it, vi } from "vitest";

import { renderRawBpmnXml } from "../../src/render/index.js";

const WITHOUT_DI = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  id="Definitions_1" targetNamespace="http://example.com/bpmn">
  <process id="Process_1" isExecutable="false">
    <startEvent id="Start_1" />
    <task id="Task_1" name="Do work" />
    <endEvent id="End_1" />
    <sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Task_1" />
    <sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="End_1" />
  </process>
</definitions>`;

const WITH_DI = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1" targetNamespace="http://example.com/bpmn">
  <process id="Process_1" isExecutable="false">
    <startEvent id="Start_1" />
  </process>
  <bpmndi:BPMNDiagram id="Diagram_1">
    <bpmndi:BPMNPlane id="Plane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1">
        <dc:Bounds x="100" y="100" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</definitions>`;

function modelerMock() {
  const zoom = vi.fn();
  const importXML = vi.fn(async () => ({ warnings: [] as unknown[] }));
  return {
    modeler: {
      importXML,
      get: vi.fn(() => ({ zoom })),
    },
    importXML,
    zoom,
  };
}

describe("renderRawBpmnXml", () => {
  it("imports existing DI without rewriting the model XML", async () => {
    const { modeler, importXML, zoom } = modelerMock();
    const result = await renderRawBpmnXml(modeler as never, WITH_DI);

    expect(result.usedAutoLayout).toBe(false);
    expect(result.layoutXml).toBe(WITH_DI);
    expect(importXML).toHaveBeenCalledWith(WITH_DI);
    expect(zoom).toHaveBeenCalledWith("fit-viewport");
  });

  it("adds DI before importing XML that has no diagram interchange", async () => {
    const { modeler, importXML } = modelerMock();
    const result = await renderRawBpmnXml(modeler as never, WITHOUT_DI);

    expect(result.usedAutoLayout).toBe(true);
    expect(result.layoutXml).toContain("BPMNDiagram");
    expect(importXML).toHaveBeenCalledWith(result.layoutXml);
  });

  it("rejects malformed XML rather than repairing it", async () => {
    const { modeler, importXML } = modelerMock();

    await expect(renderRawBpmnXml(modeler as never, "<definitions>"))
      .rejects.toThrow();
    expect(importXML).not.toHaveBeenCalled();
  });
});
