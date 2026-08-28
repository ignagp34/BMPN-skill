/**
 * Visual constants for the headless renderer.
 *
 * The defaults reproduce the conventional bpmn.io look — black stroke, white
 * fill, Arial 12 — because that is what BPMN modellers and reviewers expect to
 * see. All glyphs in `draw.ts` are drawn from primitives in this file's terms,
 * so a palette swap re-themes the whole diagram.
 */
export interface Theme {
  stroke: string;
  fill: string;
  text: string;
  /** Fill for solid glyph interiors (throw events, send task envelope). */
  solid: string;
  fontFamily: string;
  fontSize: number;
  /** Line height used for wrapped labels. */
  lineHeight: number;
  /** Stroke width for ordinary element outlines. */
  strokeWidth: number;
  /** Stroke width for end events. */
  endEventStrokeWidth: number;
}

export const LIGHT_THEME: Theme = {
  stroke: "#000000",
  fill: "#ffffff",
  text: "#000000",
  solid: "#000000",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: 12,
  lineHeight: 14,
  strokeWidth: 2,
  endEventStrokeWidth: 4,
};

export const DARK_THEME: Theme = {
  ...LIGHT_THEME,
  stroke: "#e6e6e6",
  fill: "#1e1e1e",
  text: "#e6e6e6",
  solid: "#e6e6e6",
};
