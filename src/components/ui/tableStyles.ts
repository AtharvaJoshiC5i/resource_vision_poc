/** Sort indicator: always visible so sortable columns are discoverable, accent when sorted. */
export function sortIconClass(active: boolean) {
  return `h-3.5 w-3.5 shrink-0 transition-colors ${active ? "text-primary" : "text-muted group-hover/sort:text-ink-soft"}`;
}

/** Header sort control — full cell width, aligned with column data. */
export function tableSortButtonClass(align: "left" | "right" = "left") {
  return [
    "rv-table-sort",
    "group/sort",
    "inline-flex",
    "w-full",
    "min-h-8",
    "items-center",
    "gap-1",
    "rounded-md",
    "px-2",
    "py-1",
    "font-semibold",
    "transition-colors",
    "hover:bg-canvas/90",
    "hover:text-ink",
    align === "right" ? "justify-end text-right" : "justify-start text-left",
  ].join(" ");
}
