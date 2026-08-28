/**
 * Bundle the engine + CLI into the skill folder.
 *
 * The result is one self-contained `bpmn-render.mjs` plus the resvg `.wasm`.
 * Together they need nothing but Node — no `npm install`, no `node_modules`, no
 * network — which is what lets `skills/bpmn/` be copied to any machine and work.
 */

import { copyFile, mkdir, rm, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "skills", "bpmn", "bin");
const ENTRY = join(ROOT, "packages", "bpmn-cli", "src", "main.ts");
const WASM_SOURCE = join(ROOT, "node_modules", "@resvg", "resvg-wasm", "index_bg.wasm");

function human(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(OUT_DIR, { recursive: true });

const result = await build({
  entryPoints: [ENTRY],
  outfile: join(OUT_DIR, "bpmn-render.mjs"),
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  minify: false,
  sourcemap: false,
  legalComments: "inline",
  banner: {
    // esbuild's ESM output can reference `require` through CommonJS deps
    // (bpmn-moddle's dependency chain does). Recreate it for the bundle.
    js: [
      "import { createRequire as __createRequire } from 'node:module';",
      "const require = __createRequire(import.meta.url);",
    ].join("\n"),
  },
  metafile: true,
  logLevel: "warning",
});

await copyFile(WASM_SOURCE, join(OUT_DIR, "resvg.wasm"));

const bundleSize = (await stat(join(OUT_DIR, "bpmn-render.mjs"))).size;
const wasmSize = (await stat(join(OUT_DIR, "resvg.wasm"))).size;

console.log(`bpmn-render.mjs  ${human(bundleSize)}`);
console.log(`resvg.wasm       ${human(wasmSize)}`);
console.log(`total            ${human(bundleSize + wasmSize)}`);

if (Object.keys(result.metafile.outputs).length === 0) {
  process.exitCode = 1;
}
