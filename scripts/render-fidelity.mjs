/**
 * Optional high-fidelity renderer: draw with bpmn-js itself, in a headless
 * browser, instead of with this repo's own SVG emitter.
 *
 * The default path (`bpmn-render`) is offline, instant and needs nothing but
 * Node — use it for everything. Reach for this script only when you need output
 * that is pixel-identical to bpmn.io's canvas, typically to match figures
 * produced by the original TFM applications.
 *
 * It is deliberately *not* part of the installed skill: it needs Playwright and
 * a Chromium download, which is exactly the weight the skill exists to avoid.
 *
 *   npx playwright install chromium
 *   npm run render:fidelity -- --dsl process.dsl --out bpmn-out --name onboarding
 *
 * Note on licensing: this path renders through bpmn-js, which is covered by the
 * bpmn.io License and its watermark clause. See THIRD-PARTY-NOTICES.md before
 * publishing anything it produces.
 */

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import process from "node:process";

import { build } from "esbuild";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const options = { dsl: null, bpmn: null, out: "bpmn-out", name: null, pngWidth: null };
  for (let i = 0; i < argv.length; i += 1) {
    const value = () => {
      const next = argv[i + 1];
      if (next === undefined) throw new Error(`Missing value for ${argv[i]}`);
      i += 1;
      return next;
    };
    switch (argv[i]) {
      case "--dsl":
        options.dsl = value();
        break;
      case "--bpmn":
        options.bpmn = value();
        break;
      case "--out":
        options.out = value();
        break;
      case "--name":
        options.name = value();
        break;
      case "--png-width":
        options.pngWidth = Number(value());
        break;
      default:
        throw new Error(`Unknown argument: ${argv[i]}`);
    }
  }
  if (options.dsl === null && options.bpmn === null) {
    throw new Error("One of --dsl or --bpmn is required.");
  }
  return options;
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    console.error(
      [
        "Playwright is not installed, so the fidelity renderer cannot run.",
        "",
        "  npm install",
        "  npx playwright install chromium",
        "",
        "The default renderer needs none of this: node skills/bpmn/bin/bpmn-render.mjs --dsl <file>",
      ].join("\n"),
    );
    process.exit(1);
  }
}

/** Bundle a browser entry that exposes `window.renderBpmn(xml) -> svg`. */
async function buildHarness(workDir) {
  const entry = join(workDir, "entry.js");
  await writeFile(
    entry,
    `import BpmnJS from "bpmn-js/lib/Modeler";

window.renderBpmn = async (xml) => {
  const container = document.getElementById("canvas");
  const modeler = new BpmnJS({ container });
  await modeler.importXML(xml);
  modeler.get("canvas").zoom("fit-viewport");
  const { svg } = await modeler.saveSVG();
  return svg;
};
`,
    "utf8",
  );

  await build({
    entryPoints: [entry],
    outfile: join(workDir, "harness.js"),
    bundle: true,
    platform: "browser",
    format: "iife",
    target: "es2020",
    logLevel: "warning",
    absWorkingDir: ROOT,
    // The entry lives in a temp directory, so point the resolver back at this
    // repo's install rather than walking up from the temp path.
    nodePaths: [join(ROOT, "node_modules")],
  });

  const css = await readFile(
    join(ROOT, "node_modules", "bpmn-js", "dist", "assets", "diagram-js.css"),
    "utf8",
  );
  const script = await readFile(join(workDir, "harness.js"), "utf8");

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
html, body { margin: 0; padding: 0; background: #fff; }
#canvas { width: 4000px; height: 3000px; }
${css}
</style></head>
<body><div id="canvas"></div><script>${script}</script></body></html>`;

  const htmlPath = join(workDir, "harness.html");
  await writeFile(htmlPath, html, "utf8");
  return htmlPath;
}

const options = parseArgs(process.argv.slice(2));
const { chromium } = await loadPlaywright();

// The layout pipeline is the same one the offline renderer uses; only the
// drawing step differs. Loaded through tsx (`npm run render:fidelity`) so the
// TypeScript engine sources can be imported directly.
const { emitBpmnXml, parseDsl, layoutBpmnXml, containsDiagramInterchange, renderSvgToPng } =
  await import(pathToFileURL(join(ROOT, "packages", "bpmn-core", "src", "headless.ts")).href);

const sourcePath = options.dsl ?? options.bpmn;
const source = await readFile(sourcePath, "utf8");

let layoutXml;
if (options.dsl !== null) {
  layoutXml = await layoutBpmnXml(emitBpmnXml(parseDsl(source).model));
} else {
  layoutXml = (await containsDiagramInterchange(source)) ? source : await layoutBpmnXml(source);
}

const workDir = await mkdtemp(join(tmpdir(), "bpmn-fidelity-"));
try {
  const htmlPath = await buildHarness(workDir);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  await page.goto(pathToFileURL(htmlPath).href);

  const svg = await page.evaluate((xml) => window.renderBpmn(xml), layoutXml);

  const name = options.name ?? "diagram";
  const outDir = resolve(options.out, name);
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, `${name}.svg`), svg, "utf8");
  await writeFile(join(outDir, `${name}.bpmn`), layoutXml, "utf8");

  await browser.close();

  // Rasterize the exported SVG rather than screenshotting the canvas: the
  // canvas is a fixed oversized viewport, so a screenshot would carry a wide
  // margin of empty page around the diagram.
  const png = await renderSvgToPng(svg, {
    width: options.pngWidth ?? undefined,
  });
  if (png === null) {
    console.warn("No system sans-serif font found; skipped the PNG. The SVG is complete.");
  } else {
    await writeFile(join(outDir, `${name}.png`), png);
  }

  console.log(`Fidelity render written to ${outDir}`);
} finally {
  await rm(workDir, { recursive: true, force: true });
}
