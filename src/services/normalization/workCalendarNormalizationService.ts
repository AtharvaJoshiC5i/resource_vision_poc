import type { CapacityConfigRecord } from "../../types/capacity";

import type { WorkCalendar } from "../../types/domain";

export function normalizeWorkCalendar(
  records: CapacityConfigRecord[],
): WorkCalendar[] {
  return records.map((record) => ({
    country: record.country,

    location: record.location,

    monthKey: record.month_key,

    workingDays: record.working_days,

    hoursPerDay: record.hours_per_day,

    monthlyCapacity: record.working_days * record.hours_per_day,
  }));
}
