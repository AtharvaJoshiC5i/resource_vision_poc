import type { FamstackRecord } from "../types/famstack";
import type { ProjectTrackRecord } from "../types/projectTrack";

function createUtilizationKey(employeeId: string, monthKey: string): string {
  return `${employeeId}::${monthKey}`;
}

export function buildHistoricalUtilizationLookup(
  records: FamstackRecord[],
): Map<string, number> {
  const lookup = new Map<string, number>();

  for (const record of records) {
    const key = createUtilizationKey(record.employee_id, record.month_key);

    const existing = lookup.get(key) ?? 0;

    lookup.set(key, existing + record.actual_effort_hours);
  }

  return lookup;
}

export function buildPlannedUtilizationLookup(
  records: ProjectTrackRecord[],
): Map<string, number> {
  const lookup = new Map<string, number>();

  for (const record of records) {
    if (record.employee_tagging === "UNASSIGNED_GRADE_DEMAND") {
      continue;
    }

    if (record.employee_id.trim() === "") {
      throw new Error(
        `Project Track record ${record.project_id} for ${record.month_key} has no employee_id but is not UNASSIGNED_GRADE_DEMAND.`,
      );
    }

    const key = createUtilizationKey(record.employee_id, record.month_key);

    const existing = lookup.get(key) ?? 0;

    lookup.set(key, existing + record.effort_value);
  }

  return lookup;
}

export function getUtilizedCapacity(
  lookup: Map<string, number>,
  employeeId: string,
  monthKey: string,
): number {
  return lookup.get(createUtilizationKey(employeeId, monthKey)) ?? 0;
}
