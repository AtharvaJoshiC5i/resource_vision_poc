/** Shared chart styling. Colours are references to the tokens in index.css. */
export const CHART_FONT = "Inter, ui-sans-serif, system-ui, sans-serif";

export const CHART_AXIS = { fontSize: 10, fill: "var(--color-muted)", fontFamily: CHART_FONT };
export const CHART_AXIS_TITLE = { ...CHART_AXIS, fontSize: 11, fontWeight: 500, fill: "var(--color-ink-soft)" };
export const CHART_GRID = { stroke: "var(--color-hairline)" };
export const CHART_CURSOR = { fill: "var(--color-canvas)" };
export const CHART_TOOLTIP = {
  borderRadius: 8,
  border: "1px solid var(--color-hairline)",
  boxShadow: "var(--shadow-popover)",
  fontFamily: CHART_FONT,
  fontSize: 11,
  background: "var(--color-surface)",
  color: "var(--color-ink-soft)",
};
