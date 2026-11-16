const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Placeholder for a missing value: a quiet en dash (never an em dash). */
export const EMPTY = "–";

/** 120 -> "120.0"; null -> en dash. */
export function hours(value: number | null | undefined): string {
  if (value === null || value === undefined) return EMPTY;
  return value.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function integer(value: number | null | undefined): string {
  if (value === null || value === undefined) return EMPTY;
  return value.toLocaleString("en-US");
}

/** "2026-10-01" -> "01 Oct 2026". */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return EMPTY;
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return EMPTY;
  return `${String(day).padStart(2, "0")} ${MONTHS[month - 1]} ${year}`;
}

/** 202611 -> "Nov 26" (compact axis label). */
export function compactMonth(key: number): string {
  return `${MONTHS[(key % 100) - 1]} ${String(Math.floor(key / 100)).slice(2)}`;
}

export function text(value: string | null | undefined): string {
  return value && value.trim() !== "" ? value : EMPTY;
}
