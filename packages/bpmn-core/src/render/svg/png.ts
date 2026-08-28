import { readFile } from "node:fs/promises";
import { platform } from "node:process";

/**
 * SVG → PNG without a browser.
 *
 * `@resvg/resvg-wasm` is a WebAssembly build of resvg, so it bundles into the
 * skill as a single `.wasm` file and rasterizes entirely offline — no Chromium,
 * no native module, no per-platform binary.
 *
 * The one thing WASM cannot do is read the host's font book, so the caller must
 * hand resvg the actual font bytes. `findSystemSansFont` locates a metric
 * substitute for Arial on each platform; if none is found, PNG output is
 * skipped and the SVG remains the primary deliverable.
 */

let initialized: Promise<void> | undefined;

async function ensureInitialized(): Promise<typeof import("@resvg/resvg-wasm")> {
  const resvg = await import("@resvg/resvg-wasm");
  if (initialized === undefined) {
    const wasmPath = new URL("../../../../../node_modules/@resvg/resvg-wasm/index_bg.wasm", import.meta.url);
    initialized = readFile(wasmPath).then(async (bytes) => {
      await resvg.initWasm(bytes);
    });
  }
  await initialized;
  return resvg;
}

/**
 * Override the WASM loader — used by the bundled skill CLI, which ships the
 * `.wasm` next to itself rather than inside `node_modules`.
 */
export function setWasmLoader(loader: () => Promise<Uint8Array>): void {
  initialized = (async () => {
    const resvg = await import("@resvg/resvg-wasm");
    await resvg.initWasm(await loader());
  })();
}

const FONT_CANDIDATES: Record<string, string[]> = {
  win32: [
    "C:/Windows/Fonts/arial.ttf",
    "C:/Windows/Fonts/segoeui.ttf",
    "C:/Windows/Fonts/calibri.ttf",
  ],
  darwin: [
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/Library/Fonts/Arial.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
  ],
  linux: [
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/usr/share/fonts/liberation-sans/LiberationSans-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/TTF/DejaVuSans.ttf",
  ],
};

/** First readable sans-serif font on this host, or `null` if none is present. */
export async function findSystemSansFont(): Promise<Uint8Array | null> {
  for (const candidate of FONT_CANDIDATES[platform] ?? FONT_CANDIDATES.linux) {
    try {
      return new Uint8Array(await readFile(candidate));
    } catch {
      continue;
    }
  }
  return null;
}

export interface PngRenderOptions {
  /** Output width in pixels. Defaults to the SVG's intrinsic width. */
  width?: number;
  /** Font bytes to register. Defaults to the first system sans-serif found. */
  fontData?: Uint8Array;
  /** Family name resvg should map the SVG's font stack to. Default "Arial". */
  fontFamily?: string;
}

/**
 * Rasterize an SVG document to PNG bytes.
 *
 * Returns `null` when no usable font could be found, so callers can degrade to
 * SVG-only output instead of emitting a PNG with missing text.
 */
export async function renderSvgToPng(
  svg: string,
  options: PngRenderOptions = {},
): Promise<Uint8Array | null> {
  const fontData = options.fontData ?? (await findSystemSansFont());
  if (fontData === null) return null;

  const resvg = await ensureInitialized();
  const renderer = new resvg.Resvg(svg, {
    background: "white",
    fitTo: options.width === undefined ? { mode: "original" } : { mode: "width", value: options.width },
    font: {
      fontBuffers: [fontData],
      defaultFontFamily: options.fontFamily ?? "Arial",
      loadSystemFonts: false,
    },
  });
  return renderer.render().asPng();
}
