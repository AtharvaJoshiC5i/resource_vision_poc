/**
 * Tables use product tokens (lavender-soft header, primary-soft hover, purple-indigo labels).
 * Tailwind must see these class strings at build time.
 */

const headCell = [
  "[&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-[3]",
  "[&_thead_th]:h-10 [&_thead_th]:px-4",
  "[&_thead_th]:bg-lavender-soft",
  "[&_thead_th]:border-b [&_thead_th]:border-primary/25",
  "[&_thead_th]:text-left [&_thead_th]:align-middle",
  "[&_thead_th]:text-[11px] [&_thead_th]:font-semibold [&_thead_th]:leading-4",
  "[&_thead_th]:text-purple-indigo",
  "[&_thead_th_button]:text-inherit [&_thead_th_button]:font-inherit",
  "[&_thead_th_button:hover]:text-primary",
  "[&_thead_th[aria-sort=ascending]]:text-ink",
  "[&_thead_th[aria-sort=descending]]:text-ink",
  "[&_thead_.rv-table-sticky-col]:z-[4] [&_thead_.rv-table-sticky-col]:bg-lavender-soft",
].join(" ");

const bodyCell = [
  "[&_tbody_td]:bg-surface [&_tbody_td]:px-4 [&_tbody_td]:py-3 [&_tbody_td]:text-[13px] [&_tbody_td]:leading-5",
  "[&_tbody_td]:border-b [&_tbody_td]:border-hairline [&_tbody_td]:align-middle",
  "[&_tbody_th]:bg-surface [&_tbody_th]:px-4 [&_tbody_th]:py-3",
  "[&_tbody_th]:border-b [&_tbody_th]:border-hairline [&_tbody_th]:align-middle [&_tbody_th]:font-normal",
  "[&_tbody_tr:last-child_td]:border-b-0 [&_tbody_tr:last-child_th]:border-b-0",
  "[&_tbody_tr:hover_td]:bg-primary-soft [&_tbody_tr:hover_th]:bg-primary-soft",
  "[&_tbody_tr:hover_.rv-table-sticky-col]:bg-primary-soft",
].join(" ");

const shell = "w-full border-separate border-spacing-0 text-sm leading-5 text-ink-soft tabular-nums";

export const tableClass = `rv-table ${shell} ${headCell} ${bodyCell} [&_tbody_tr:focus-visible]:outline [&_tbody_tr:focus-visible]:outline-2 [&_tbody_tr:focus-visible]:outline-primary [&_tbody_tr:focus-visible]:-outline-offset-2`;

export const tableClassDense = `${tableClass} [&_thead_th]:h-9 [&_tbody_td]:py-2.5 [&_tbody_th]:py-2.5 text-[13px]`;

export const tableClassInteractive = `${tableClass} [&_tbody_tr]:cursor-pointer`;

export const tableClassMatrix = [
  tableClassDense,
  "[&_thead_th:not(.rv-table-sticky-col)]:text-center [&_thead_th:not(.rv-table-sticky-col)]:px-2",
  "[&_tbody_td]:px-2 [&_tbody_td]:py-2 [&_tbody_td]:text-center",
  "[&_tbody_td]:border-r [&_tbody_td]:border-primary/10",
  "[&_tbody_td:last-child]:border-r-0",
].join(" ");

export const tableClassProseHeader = [
  tableClassDense,
  "[&_thead_th]:h-auto [&_thead_th]:py-2.5 [&_thead_th]:whitespace-normal [&_thead_th]:text-ink-soft",
].join(" ");

export const tableFrameClass = [
  "rv-table-frame overflow-auto overscroll-behavior-contain rounded-xl",
  "border border-hairline bg-surface shadow-(--shadow-card)",
  "ring-1 ring-primary/10",
].join(" ");

export const tableFrameNestedClass = [
  "rv-table-frame rv-table-frame--nested",
  "mt-5 overflow-auto overscroll-behavior-contain rounded-lg",
  "border border-hairline bg-surface",
  "ring-1 ring-inset ring-primary/8",
].join(" ");

export const tableStickyColClass = [
  "rv-table-sticky-col sticky left-0 z-[2] pl-4",
  "border-r border-primary/15 bg-inherit",
].join(" ");

export const tableTotalColClass = [
  "rv-table-total border-l border-primary/15",
  "bg-lavender-soft/60 font-medium text-ink",
].join(" ");

export const tableHeadClass = "";
