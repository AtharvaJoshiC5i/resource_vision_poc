/** Profile tags shown beside availability: Business Vertical, tenure band and current clients. */

export type TenureBand = "Fresher" | "Lateral" | "Unknown";

/** Matches backend FRESHER_MAX_MONTHS: 0 to 18 completed months since date of joining is Fresher. */
export const FRESHER_MAX_MONTHS = 18;

export const TENURE_HINT: Record<TenureBand, string> = {
  Fresher: `0–${FRESHER_MAX_MONTHS} months since joining`,
  Lateral: `More than ${FRESHER_MAX_MONTHS} months since joining`,
  Unknown: "No join date on file",
};

export function tenureOptions(bands: string[] | undefined) {
  return (bands ?? []).map((band) => ({
    value: band,
    label: band,
    hint: TENURE_HINT[band as TenureBand],
  }));
}

export function listOptions(values: string[] | undefined) {
  return (values ?? []).map((v) => ({ value: v, label: v }));
}

/** "Acme" or "Acme +2"; the full list goes in a tooltip. */
export function clientSummary(clients: string[]): { short: string; full: string } | null {
  if (clients.length === 0) return null;
  const extra = clients.length - 1;
  return { short: extra > 0 ? `${clients[0]} +${extra}` : clients[0]!, full: clients.join(", ") };
}

export function tenureLabel(band: string | null | undefined, months?: number | null): string {
  if (!band || band === "Unknown") return "Unknown";
  if (months == null) return band;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const span = years > 0 ? `${years} y ${rest} m` : `${rest} m`;
  return `${band} (${span})`;
}
