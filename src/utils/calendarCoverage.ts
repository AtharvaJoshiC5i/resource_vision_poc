import { getMonthRange } from "../services/monthService";

export function hasCalendarCoverage(
  startMonth: string,
  numberOfMonths: number,
  calendarMonthKeys: readonly string[],
): boolean {
  const requestedMonths = getMonthRange(startMonth, numberOfMonths);
  const availableMonths = new Set(calendarMonthKeys);

  return requestedMonths.every((monthKey) => availableMonths.has(monthKey));
}
