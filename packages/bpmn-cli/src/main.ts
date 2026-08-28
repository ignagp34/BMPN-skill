#!/usr/bin/env node
/**
 * `bpmn-render` — the offline half of the `/bpmn` skill.
 *
 * Reads Sketch Miner DSL (or ready-made BPMN XML), runs the engine's layout
 * pipeline, and writes the diagram as SVG, PNG and BPMN 2.0 alongside the DSL
 * that produced it. Everything happens in-process: no browser, no server, no
 * network.
 *
 * It always prints a single JSON object on stdout so the calling agent can act
 * on the outcome — retrying with the reported parse errors when the DSL is
 * wrong, or showing the user the diagram when it is not. Diagnostics go to
 * stderr, never stdout.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import {
  containsDiagramInterchange,
  emitBpmnXml,
  layoutBpmnXml,
  parseDsl,
  renderBpmnSvg,
  renderSvgToPng,
  setWasmLoader,
  validateBpmnModel,
  type BpmnValidationFinding,
} from "@text-to-bpmn/core/headless";

const FORMATS = ["svg", "png", "bpmn", "dsl"] as const;
type Format = (typeof FORMATS)[number];

interface Options {
  input: string | null;
  inputKind: "dsl" | "bpmn";
  outDir: string;
  name: string | null;
  formats: Format[];
  theme: "light" | "dark";
  pngWidth: number | null;
  padding: number;
  quiet: boolean;
}

const USAGE = `bpmn-render — natural-language BPMN engine, offline.

Usage:
  bpmn-render --dsl <file|->  [options]
  bpmn-render --bpmn <file|-> [options]

Options:
  --dsl <path>        Sketch Miner DSL source. "-" reads stdin.
  --bpmn <path>       BPMN 2.0 XML instead of DSL. "-" reads stdin.
  --out <dir>         Output directory. Default: ./bpmn-out
  --name <slug>       Base name for the artifacts. Default: input file name, or "diagram".
  --formats <list>    Comma-separated subset of svg,png,bpmn,dsl. Default: all.
  --theme <name>      light (default) or dark.
  --png-width <px>    PNG raster width. Default: the diagram's natural width.
  --padding <px>      Whitespace around the diagram. Default: 20.
  --quiet             Suppress the human-readable summary on stderr.
  -h, --help          Show this help.

Always prints one JSON result object on stdout.`;

function parseArgs(argv: string[]): Options | "help" {
  const options: Options = {
    input: null,
    inputKind: "dsl",
    outDir: "bpmn-out",
    name: null,
    formats: [...FORMATS],
    theme: "light",
    pngWidth: null,
    padding: 20,
    quiet: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = (): string => {
      const value = argv[i + 1];
      if (value === undefined) throw new Error(`Missing value for ${arg}`);
      i += 1;
      return value;
    };

    switch (arg) {
      case "-h":
      case "--help":
        return "help";
      case "--dsl":
        options.input = next();
        options.inputKind = "dsl";
        break;
      case "--bpmn":
        options.input = next();
        options.inputKind = "bpmn";
        break;
      case "--out":
        options.outDir = next();
        break;
      case "--name":
        options.name = next();
        break;
      case "--formats": {
        const requested = next()
          .split(",")
          .map((value) => value.trim().toLowerCase())
          .filter((value) => value.length > 0);
        const unknown = requested.filter((value) => !FORMATS.includes(value as Format));
        if (unknown.length > 0) throw new Error(`Unknown format(s): ${unknown.join(", ")}`);
        options.formats = requested as Format[];
        break;
      }
      case "--theme": {
        const value = next();
        if (value !== "light" && value !== "dark") throw new Error(`Unknown theme: ${value}`);
        options.theme = value;
        break;
      }
      case "--png-width":
        options.pngWidth = Number(next());
        break;
      case "--padding":
        options.padding = Number(next());
        break;
      case "--quiet":
        options.quiet = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.input === null) throw new Error("One of --dsl or --bpmn is required.");
  return options;
}

async function readInput(path: string): Promise<string> {
  if (path === "-") {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks).toString("utf8");
  }
  return readFile(path, "utf8");
}

/** Slugify a name into something safe for a folder on every platform. */
function slugify(value: string): string {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug.length > 0 ? slug : "diagram";
}

function summarize(findings: BpmnValidationFinding[]): Array<Record<string, string>> {
  return findings.map((finding) => ({
    code: finding.code,
    severity: finding.severity,
    element: finding.elementName ?? finding.elementId ?? "",
    message: finding.message,
  }));
}

/**
 * Point the WASM rasterizer at the `.wasm` shipped next to the bundled CLI.
 *
 * The bundle has no `node_modules` to look in, so the loader is wired up here
 * rather than left to the library default.
 */
function configureWasm(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  setWasmLoader(async () => new Uint8Array(await readFile(join(here, "resvg.wasm"))));
}

async function main(): Promise<number> {
  let options: Options | "help";
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stdout.write(
      `${JSON.stringify({ ok: false, stage: "arguments", error: (err as Error).message }, null, 2)}\n`,
    );
    return 2;
  }

  if (options === "help") {
    process.stderr.write(`${USAGE}\n`);
    return 0;
  }

  const source = await readInput(options.input as string);
  const baseName =
    options.name !== null
      ? slugify(options.name)
      : options.input === "-"
        ? "diagram"
        : slugify(basename(options.input as string, extname(options.input as string)));

  let dsl: string | null = null;
  let semanticXml: string;
  let parseErrors: Array<Record<string, unknown>> = [];
  let model: ReturnType<typeof parseDsl>["model"] | null = null;

  if (options.inputKind === "dsl") {
    dsl = source;
    const parsed = parseDsl(source);
    model = parsed.model;
    parseErrors = parsed.errors.map((error) => ({ ...error }));
    if (parsed.model.flowNodes.size === 0) {
      process.stdout.write(
        `${JSON.stringify(
          {
            ok: false,
            stage: "parse",
            error: "The DSL produced no diagram elements.",
            parseErrors,
          },
          null,
          2,
        )}\n`,
      );
      return 1;
    }
    semanticXml = emitBpmnXml(parsed.model);
  } else {
    semanticXml = source;
  }

  let layoutXml: string;
  try {
    layoutXml =
      options.inputKind === "bpmn" && (await containsDiagramInterchange(semanticXml))
        ? semanticXml
        : await layoutBpmnXml(semanticXml);
  } catch (err) {
    process.stdout.write(
      `${JSON.stringify(
        { ok: false, stage: "layout", error: (err as Error).message, parseErrors },
        null,
        2,
      )}\n`,
    );
    return 1;
  }

  const svg = await renderBpmnSvg(layoutXml, {
    theme: options.theme,
    padding: options.padding,
  });

  const outDir = resolve(options.outDir, baseName);
  await mkdir(outDir, { recursive: true });
  const written: Record<string, string> = {};

  if (options.formats.includes("svg")) {
    const path = join(outDir, `${baseName}.svg`);
    await writeFile(path, svg, "utf8");
    written.svg = path;
  }
  if (options.formats.includes("bpmn")) {
    const path = join(outDir, `${baseName}.bpmn`);
    await writeFile(path, layoutXml, "utf8");
    written.bpmn = path;
  }
  if (options.formats.includes("dsl") && dsl !== null) {
    const path = join(outDir, `${baseName}.dsl`);
    await writeFile(path, dsl, "utf8");
    written.dsl = path;
  }

  let pngNote: string | undefined;
  if (options.formats.includes("png")) {
    configureWasm();
    try {
      const png = await renderSvgToPng(svg, {
        width: options.pngWidth ?? undefined,
      });
      if (png === null) {
        pngNote = "No system sans-serif font was found, so the PNG was skipped. The SVG is complete.";
      } else {
        const path = join(outDir, `${baseName}.png`);
        await writeFile(path, png);
        written.png = path;
      }
    } catch (err) {
      pngNote = `PNG rasterization failed (${(err as Error).message}). The SVG is complete.`;
    }
  }

  const validation =
    model !== null ? validateBpmnModel(model, { layoutXml }) : null;

  const result = {
    ok: true,
    name: baseName,
    outDir,
    files: written,
    parseErrors,
    validation:
      validation === null
        ? null
        : {
            status: validation.status,
            metrics: validation.metrics,
            errors: summarize(validation.errors),
            warnings: summarize(validation.warnings),
          },
    ...(pngNote === undefined ? {} : { pngNote }),
  };

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

  if (!options.quiet) {
    const paths = Object.values(written).join("\n  ");
    process.stderr.write(`Diagram written to:\n  ${paths}\n`);
  }
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (err: unknown) => {
    process.stdout.write(
      `${JSON.stringify({ ok: false, stage: "unexpected", error: String(err) }, null, 2)}\n`,
    );
    process.exitCode = 1;
  },
);
