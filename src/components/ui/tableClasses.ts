/**
 * Table class names. The styling itself lives in index.css (`@layer components`, `.rv-table*`),
 * so per-cell utilities such as `text-right` or `pl-8` always win over the table defaults.
 *
 * Rules the system follows:
 * - Text left-aligned, numbers right-aligned, headers aligned with their column.
 * - 16px gutter on the outer columns, 12px between columns.
 * - Regular rows ~48px, dense rows ~40px; horizontal rules only, no vertical grid lines.
 * - Tabular figures everywhere so digits line up down a column.
 */

export const tableClass = "rv-table";

export const tableClassDense = "rv-table rv-table--dense";

export const tableClassInteractive = "rv-table rv-table--interactive";

/** Month grids: compact rows, centred status tiles. Hour columns opt into `text-right` per cell. */
export const tableClassMatrix = "rv-table rv-table--dense rv-table--matrix";

/** Dense table whose headers may wrap onto two lines. */
export const tableClassProseHeader = "rv-table rv-table--dense rv-table--prose";

export const tableFrameClass = [
  "rv-table-frame rv-frame rv-scroll overflow-auto overscroll-behavior-contain rounded-xl",
].join(" ");

export const tableStickyColClass = "rv-table-sticky-col";

export const tableTotalColClass = "rv-table-total";

export const tableHeadClass = "rv-table-th";

/** Plain column title inside a header cell (no sort control). */
export const tableHeadLabelClass = "rv-table-head-label";

/** Bordered surface panel (cards, decks, table shells). */
export const surfaceFrameClass = "rv-frame rounded-xl";
