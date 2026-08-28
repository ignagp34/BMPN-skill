import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { emitBpmnXml } from "../../src/bpmn/emit.js";
import { parseDsl } from "../../src/dsl/index.js";
import { layoutBpmnXml } from "../../src/render/pipeline.js";
import { buildScene, sceneBounds } from "../../src/render/svg/scene.js";
import { renderBpmnSvg } from "../../src/render/svg/index.js";
import { measureAnnotation, measureText, wrapText } from "../../src/render/svg/text.js";

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

  it("tiles every participant completely with its lanes", async () => {
    for (const fixture of ["canon-1-cheeseburger", "canon-5-marriage"]) {
      const scene = await buildScene(await layoutFixture(fixture));
      const participants = scene.shapes.filter((shape) => shape.type === "Participant");
      expect(participants.length, fixture).toBeGreaterThan(0);

      for (const participant of participants) {
        const lanes = scene.shapes
          .filter(
            (shape) =>
              shape.type === "Lane" &&
              shape.bounds.y >= participant.bounds.y - 1 &&
              shape.bounds.y + shape.bounds.height <=
                participant.bounds.y + participant.bounds.height + 1,
          )
          .sort((a, b) => a.bounds.y - b.bounds.y);
        if (lanes.length === 0) continue;

        const label = `${fixture} / ${participant.name}`;
        expect(lanes[0].bounds.y, label).toBeCloseTo(participant.bounds.y, 5);

        const last = lanes[lanes.length - 1];
        expect(last.bounds.y + last.bounds.height, label).toBeCloseTo(
          participant.bounds.y + participant.bounds.height,
          5,
        );

        // No gap between consecutive lanes either.
        for (let i = 1; i < lanes.length; i += 1) {
          expect(lanes[i].bounds.y, label).toBeCloseTo(
            lanes[i - 1].bounds.y + lanes[i - 1].bounds.height,
            5,
          );
        }
      }
    }
  });

  it("sizes every text annotation to the text it holds", async () => {
    const scene = await buildScene(await layoutFixture("canon-5-marriage"));
    const annotations = scene.shapes.filter((shape) => shape.type === "TextAnnotation");
    expect(annotations.length).toBeGreaterThan(0);

    const heights = new Set<number>();
    for (const annotation of annotations) {
      const expected = measureAnnotation(annotation.name);
      expect(annotation.bounds.width, annotation.name).toBe(expected.width);
      expect(annotation.bounds.height, annotation.name).toBe(expected.height);
      heights.add(annotation.bounds.height);
    }

    // Notes of different lengths must not all end up the same fixed box.
    expect(heights.size).toBeGreaterThan(1);
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

  it("sizes the canvas around auto-placed labels so none is cropped", async () => {
    // A named start event on the far left has a label wider than its circle and
    // no DI label box to be measured from. Sizing the canvas to the shapes
    // alone sliced the first characters off.
    const { model } = parseDsl("(start Un evento inicial de nombre largo)\nRevisar\n");
    const layoutXml = await layoutBpmnXml(emitBpmnXml(model));
    const svg = await renderBpmnSvg(layoutXml);

    const viewBox = /viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)"/.exec(svg);
    expect(viewBox).not.toBeNull();
    const [minX, minY, width, height] = viewBox!.slice(1).map(Number);

    const labels = Array.from(svg.matchAll(/<tspan x="(-?[\d.]+)" y="(-?[\d.]+)">([^<]*)</g));
    expect(labels.length).toBeGreaterThan(0);

    for (const [, x, y, content] of labels) {
      const half = measureText(content, 12) / 2;
      expect(Number(x) - half, content).toBeGreaterThanOrEqual(minX);
      expect(Number(x) + half, content).toBeLessThanOrEqual(minX + width);
      expect(Number(y), content).toBeGreaterThanOrEqual(minY);
      expect(Number(y), content).toBeLessThanOrEqual(minY + height);
    }
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

  it("draws edge labels after every shape so they are never painted over", async () => {
    const layoutXml = await layoutFixture("canon-5-marriage");
    const svg = await renderBpmnSvg(layoutXml);

    const lastShape = svg.lastIndexOf('class="bpmn-shape ');
    const firstEdgeLabel = svg.indexOf('class="bpmn-edge-label"');
    expect(firstEdgeLabel).toBeGreaterThan(-1);
    expect(firstEdgeLabel).toBeGreaterThan(lastShape);
  });

  it("keeps an event's label out of its lane's name strip", async () => {
    // A start event sits flush against the lane's left edge, and its label is
    // far wider than the 36 px circle. Centred blindly it lands on the lane
    // header; this is the regression guard for that.
    const layoutXml = await layoutFixture("canon-1-cheeseburger");
    const scene = await buildScene(layoutXml);
    const svg = await renderBpmnSvg(layoutXml);

    const start = scene.shapes.find((shape) => shape.type === "StartEvent");
    expect(start).toBeDefined();

    const lane = scene.shapes
      .filter((shape) => shape.type === "Lane")
      .find(
        (shape) =>
          start!.bounds.x >= shape.bounds.x &&
          start!.bounds.y >= shape.bounds.y &&
          start!.bounds.y <= shape.bounds.y + shape.bounds.height,
      );
    expect(lane).toBeDefined();

    const group = new RegExp(
      `<g class="bpmn-shape-label" data-element-id="${start!.id}">(.*?)</g>`,
      "s",
    ).exec(svg);
    expect(group).not.toBeNull();

    const centres = Array.from(group![1].matchAll(/<tspan x="(-?[\d.]+)"/g)).map((match) =>
      Number(match[1]),
    );
    expect(centres.length).toBeGreaterThan(0);

    // Half the widest rendered line must clear the 30 px header strip.
    const halfWidth =
      Math.max(...wrapText(start!.name, Math.max(start!.bounds.width * 2.6, 90), 12).map((line) =>
        measureText(line, 12),
      )) / 2;
    for (const centre of centres) {
      expect(centre - halfWidth).toBeGreaterThanOrEqual(lane!.bounds.x + 30);
    }
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
