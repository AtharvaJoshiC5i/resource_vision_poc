/** Sort indicator: quiet until the column is hovered, solid when the column is sorted. */
export function sortIconClass(active: boolean) {
  return `h-3.5 w-3.5 shrink-0 transition-opacity ${active ? "text-primary" : "text-purple-indigo/40 group-hover/sort:text-primary group-hover/sort:opacity-100"}`;
}
