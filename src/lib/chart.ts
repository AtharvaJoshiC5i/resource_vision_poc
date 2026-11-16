/** Shared chart styling. Colours are references to the tokens in index.css. */
export const CHART_FONT = "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif";

export const CHART_AXIS = { fontSize: 11, fill: "var(--color-muted)", fontFamily: CHART_FONT };
export const CHART_AXIS_TITLE = { ...CHART_AXIS, fontSize: 11, fontWeight: 500, fill: "var(--color-ink-soft)" };
export const CHART_GRID = { stroke: "var(--color-hairline)", strokeDasharray: "3 4" };
export const CHART_CURSOR = { fill: "color-mix(in srgb, var(--color-primary) 5%, transparent)" };
export const CHART_TOOLTIP = {
  borderRadius: 10,
  border: "none",
  boxShadow: "var(--shadow-popover)",
  fontFamily: CHART_FONT,
  fontSize: 12,
  background: "var(--color-surface)",
  color: "var(--color-ink-soft)",
};
