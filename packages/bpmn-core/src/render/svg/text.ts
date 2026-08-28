/**
 * Text metrics and word wrapping for the headless SVG renderer.
 *
 * There is no canvas to measure with, so widths come from the Helvetica
 * advance-width table (units per 1000 em). Arial is metrically compatible with
 * Helvetica, so a viewer rendering the SVG with either face wraps at the same
 * points we computed here — labels stay inside their shapes.
 */

/** Advance widths for ASCII 32..126, in 1/1000 em. */
const HELVETICA_WIDTHS: readonly number[] = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

/** Latin-1 accented letters share the advance width of their base letter. */
const FALLBACK_WIDTH = 556;

function charWidth(code: number): number {
  if (code >= 32 && code <= 126) return HELVETICA_WIDTHS[code - 32];
  // Combining marks and zero-width characters advance nothing.
  if (code === 0x200b || (code >= 0x0300 && code <= 0x036f)) return 0;
  return FALLBACK_WIDTH;
}

/** Width of `value` in pixels when set in Arial/Helvetica at `fontSize`. */
export function measureText(value: string, fontSize: number): number {
  let units = 0;
  for (let i = 0; i < value.length; i += 1) {
    units += charWidth(value.charCodeAt(i));
  }
  return (units * fontSize) / 1000;
}

/**
 * Greedy word wrap to `maxWidth`. Words longer than the line box are split
 * character by character rather than allowed to overflow the shape.
 */
export function wrapText(value: string, maxWidth: number, fontSize: number): string[] {
  const paragraphs = value.split(/\r?\n/);
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter((word) => word.length > 0);
    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let current = "";
    for (const word of words) {
      const candidate = current.length === 0 ? word : `${current} ${word}`;
      if (measureText(candidate, fontSize) <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current.length > 0) {
        lines.push(current);
        current = "";
      }
      if (measureText(word, fontSize) <= maxWidth) {
        current = word;
        continue;
      }
      // Single word wider than the line box: hard-break it.
      const chunks = breakWord(word, maxWidth, fontSize);
      for (let i = 0; i < chunks.length - 1; i += 1) lines.push(chunks[i]);
      current = chunks[chunks.length - 1] ?? "";
    }
    if (current.length > 0) lines.push(current);
  }

  return lines.length > 0 ? lines : [""];
}

function breakWord(word: string, maxWidth: number, fontSize: number): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const char of word) {
    const candidate = current + char;
    if (current.length > 0 && measureText(candidate, fontSize) > maxWidth) {
      chunks.push(current);
      current = char;
      continue;
    }
    current = candidate;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/** XML-escape a string for use as SVG text content or an attribute value. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ---------------------------------------------------------------------------
// Text annotation sizing
// ---------------------------------------------------------------------------

/**
 * Geometry of a BPMN text annotation, shared by the layout pass that sizes the
 * shape and the renderer that fills it.
 *
 * Both sides must agree, or the bracket ends up too big for a short note and
 * too small for a long one. `ANNOTATION_CONTENT_INSET` is the horizontal space
 * the bracket and its gutter take from the box.
 */
export const ANNOTATION_FONT_SIZE = 12;
export const ANNOTATION_LINE_HEIGHT = 14;
export const ANNOTATION_CONTENT_INSET = 20;
export const ANNOTATION_PADDING_Y = 8;
export const ANNOTATION_MIN_WIDTH = 90;
export const ANNOTATION_MAX_WIDTH = 150;
export const ANNOTATION_MIN_HEIGHT = 30;

/** Width available for text inside an annotation box of the given width. */
export function annotationContentWidth(boxWidth: number): number {
  return Math.max(boxWidth - ANNOTATION_CONTENT_INSET, 20);
}

/** Box that fits `text` snugly, wrapping at `ANNOTATION_MAX_WIDTH`. */
export function measureAnnotation(text: string): { width: number; height: number; lines: string[] } {
  const oneLine = measureText(text, ANNOTATION_FONT_SIZE) + ANNOTATION_CONTENT_INSET;
  const width = Math.round(
    Math.min(Math.max(oneLine, ANNOTATION_MIN_WIDTH), ANNOTATION_MAX_WIDTH),
  );
  const lines = wrapText(text, annotationContentWidth(width), ANNOTATION_FONT_SIZE);
  const height = Math.max(
    ANNOTATION_MIN_HEIGHT,
    lines.length * ANNOTATION_LINE_HEIGHT + 2 * ANNOTATION_PADDING_Y,
  );
  return { width, height, lines };
}
