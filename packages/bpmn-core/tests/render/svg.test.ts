import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { emitBpmnXml } from "../../src/bpmn/emit.js";
import { parseDsl } from "../../src/dsl/index.js";
import { layoutBpmnXml } from "../../src/render/pipeline.js";
import { buildScene, sceneBounds } from "../../src/render/svg/scene.js";
import { renderBpmnSvg } from "../../src/render/svg/index.js";
import { measureText, wrapText } from "../../src/render/svg/text.js";

const fixturesDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

async function layoutFixture(name: string): Promise<string> {
  const dsl = readFileSync(join(fixturesDir, `${name}.dsl`), "utf8");
  const { model } = parseDsl(dsl);
  return layoutBpmnXml(emitBpmnXml(model));
}

function countOccurrences(haystack: string, needle: RegExp): number {
  return haystack.match(needle)?.length ?? 0;
}

describe("text metrics", () => {
  it("measures proportionally: a narrow string is narrower than a wide one", () => {
    expect(measureText("iii", 12)).toBeLessThan(measureText("WWW", 12));
  });

  it("scales linearly with font size", () => {
    expect(measureText("Approve request", 24)).toBeCloseTo(measureText("Approve request", 12) * 2, 5);
  });

  it("wraps to lines that each fit the box", () => {
    const lines = wrapText("Verify the applicant identity documents thoroughly", 90, 12);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(measureText(line, 12)).toBeLessThanOrEqual(90);
    }
  });

  it("hard-breaks a single word wider than the box instead of overflowing", () => {
    const lines = wrapText("Betriebsvereinbarungsentwurf", 40, 12);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(measureText(line, 12)).toBeLessThanOrEqual(40);
    }
  });

  it("keeps every word of the input", () => {
    const source = "Reject the marriage file and notify both partners";
    expect(wrapText(source, 80, 12).join(" ")).toBe(source);
  });
});

describe("scene extraction", () => {
  it("reads shapes, edges and a non-empty bounding box from laid-out XML", async () => {
    const scene = await buildScene(await layoutFixture("canon-1-cheeseburger"));
    expect(scene.shapes.length).toBeGreaterThan(20);
    expect(scene.edges.length).toBeGreaterThan(20);

    const bounds = sceneBounds(scene);
    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.height).toBeGreaterThan(0);
  });

  it("draws containers before flow elements so pools stay behind their contents", async () => {
    const scene = await buildScene(await layoutFixture("canon-1-cheeseburger"));
    const isContainer = (shape: { type: string }): boolean =>
      shape.type === "Participant" || shape.type === "Lane";
    let lastContainer = -1;
    for (let i = 0; i < scene.shapes.length; i += 1) {
      if (isContainer(scene.shapes[i])) lastContainer = i;
    }
    const firstFlowNode = scene.shapes.findIndex((shape) => !isContainer(shape));
    expect(lastContainer).toBeGreaterThanOrEqual(0);
    expect(lastContainer).toBeLessThan(firstFlowNode);
  });

  it("takes a text annotation's label from bpmn:text, not from name", async () => {
    const scene = await buildScene(await layoutFixture("canon-5-marriage"));
    const annotations = scene.shapes.filter((shape) => shape.type === "TextAnnotation");
    expect(annotations.length).toBeGreaterThan(0);
    for (const annotation of annotations) {
      expect(annotation.name.length).toBeGreaterThan(0);
    }
  });

  it("rejects XML without diagram interchange", async () => {
    const { model } = parseDsl("Place Order\nShip Order\n");
    await expect(buildScene(emitBpmnXml(model))).rejects.toThrow(/diagram interchange/i);
  });
});

describe("SVG rendering", () => {
  it("produces a standalone SVG document with a viewBox covering the diagram", async () => {
    const svg = await renderBpmnSvg(await layoutFixture("canon-1-cheeseburger"));
    expect(svg.startsWith("<?xml")).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');

    const viewBox = /viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)"/.exec(svg);
    expect(viewBox).not.toBeNull();
    expect(Number(viewBox?.[3])).toBeGreaterThan(100);
    expect(Number(viewBox?.[4])).toBeGreaterThan(100);
  });

  it("defines the arrowheads its edges reference", async () => {
    const svg = await renderBpmnSvg(await layoutFixture("canon-1-cheeseburger"));
    for (const id of ["bpmn-sequence-end", "bpmn-message-end", "bpmn-message-start"]) {
      expect(svg).toContain(`id="${id}"`);
    }
    expect(svg).toContain('marker-end="url(#bpmn-sequence-end)"');
  });

  it("draws one polyline per edge and renders every task label", async () => {
    const layoutXml = await layoutFixture("canon-1-cheeseburger");
    const scene = await buildScene(layoutXml);
    const svg = await renderBpmnSvg(layoutXml);

    expect(countOccurrences(svg, /class="bpmn-edge /g)).toBe(scene.edges.length);
    for (const shape of scene.shapes) {
      if (shape.type !== "Task" || shape.name.length === 0) continue;
      const firstWord = shape.name.split(" ")[0];
      expect(svg).toContain(firstWord);
    }
  });

  it("marks exclusive gateways even when the DI omits isMarkerVisible", async () => {
    // Externally authored BPMN often leaves the marker off, which renders an
    // exclusive gateway as a bare diamond — indistinguishable from a parallel
    // one at a glance. The renderer draws the X anyway unless told not to.
    const layoutXml = (await layoutFixture("canon-5-marriage")).replace(
      / isMarkerVisible="true"/g,
      "",
    );
    expect(layoutXml).not.toContain("isMarkerVisible");

    const withMarker = await renderBpmnSvg(layoutXml);
    const withoutMarker = await renderBpmnSvg(layoutXml, { alwaysShowExclusiveMarker: false });
    expect(withMarker.length).toBeGreaterThan(withoutMarker.length);
  });

  it("escapes XML metacharacters in labels", async () => {
    const { model } = parseDsl('Review <script> & "quotes"\nApprove\n');
    const svg = await renderBpmnSvg(await layoutBpmnXml(emitBpmnXml(model)));
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
  });

  it("repaints backgrounds and strokes for the dark theme", async () => {
    const layoutXml = await layoutFixture("s17-order-to-ship");
    const light = await renderBpmnSvg(layoutXml, { theme: "light" });
    const dark = await renderBpmnSvg(layoutXml, { theme: "dark" });
    expect(light).toContain('fill="#ffffff"');
    expect(dark).toContain('fill="#1e1e1e"');
    expect(dark).toContain('stroke="#e6e6e6"');
  });

  it("renders every bundled fixture without throwing", async () => {
    const fixtures = [
      "canon-1-cheeseburger",
      "canon-2-incoming-flight",
      "canon-3-conveyor-belt",
      "canon-4-composting",
      "canon-5-marriage",
      "es-almacen",
      "gemini-03",
      "gemini-04",
      "gemini-05",
      "planta-residuos",
      "s17-document-approval",
      "s17-job-application",
      "s17-order-to-ship",
      "s17-pizza-order",
    ];

    for (const fixture of fixtures) {
      const svg = await renderBpmnSvg(await layoutFixture(fixture));
      expect(svg, fixture).toContain("</svg>");
      expect(svg.length, fixture).toBeGreaterThan(500);
    }
  }, 60_000);
});
