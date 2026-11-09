import type { MonthOption } from "../../api/types";

function monthKeyFromIso(iso: string | undefined): number | null {
  if (!iso) return null;
  const [year, month] = iso.split("-").map(Number);
  return year && month ? year * 100 + month : null;
}

export function resolveDirectoryReportingMonth(
  window: MonthOption[],
  monthParam: string,
  today: string | undefined,
): number | undefined {
  if (monthParam) {
    const parsed = Number(monthParam);
    if (window.some((m) => m.key === parsed)) return parsed;
  }
  const todayKey = monthKeyFromIso(today);
  if (todayKey !== null && window.some((m) => m.key === todayKey)) return todayKey;
  return window[0]?.key;
}
