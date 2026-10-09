import type { Allocation, HistoricalActivity } from "../../types/domain";

import type { FamstackRecord } from "../../types/famstack";

export function normalizeHistoricalActivity(
  records: FamstackRecord[],
): HistoricalActivity[] {
  return records.map((record) => ({
    employeeId: record.employee_id,

    projectId: record.project_id,

    monthKey: record.month_key,

    actualEffortHours: record.actual_effort_hours,

    workCategory: record.work_category,
  }));
}

export function normalizeHistoricalAllocations(
  records: FamstackRecord[],
): Allocation[] {
  return records.map((record) => ({
    employeeId: record.employee_id,

    projectId: record.project_id,

    monthKey: record.month_key,

    allocatedHours: record.actual_effort_hours,

    source: "FAMSTACK" as const,
  }));
}
