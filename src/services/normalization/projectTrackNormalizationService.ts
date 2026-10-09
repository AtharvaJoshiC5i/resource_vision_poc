import type { Allocation, Project } from "../../types/domain";

import type { ProjectTrackRecord } from "../../types/projectTrack";

/*
 * POC SOURCE CONTRACT
 * -------------------
 *
 * Project Track employee-month planned effort is
 * currently represented by `effort_value`.
 *
 * This assumption belongs ONLY in the Project Track
 * normalization adapter.
 *
 * If the authoritative production field later
 * becomes effort_value_mp or another source column,
 * only this function should need to change.
 */
function getPlannedEffortHours(record: ProjectTrackRecord): number {
  return record.effort_value;
}

export function normalizeProjects(records: ProjectTrackRecord[]): Project[] {
  const projects = new Map<string, Project>();

  for (const record of records) {
    const key =
      record.project_id || record.proposal_number || record.project_name;

    if (projects.has(key)) {
      continue;
    }

    projects.set(key, {
      projectId: record.project_id,

      proposalNumber: record.proposal_number,

      projectName: record.project_name,

      projectStatus: record.project_status,

      startDate: record.start_date,

      endDate: record.end_date,
    });
  }

  return [...projects.values()];
}

export function normalizeProjectTrackAllocations(
  records: ProjectTrackRecord[],
): Allocation[] {
  return records
    .filter(
      (record) =>
        record.employee_tagging === "TAGGED" &&
        record.employee_id.trim() !== "",
    )
    .map((record) => ({
      employeeId: record.employee_id,

      projectId: record.project_id,

      monthKey: record.month_key,

      allocatedHours: getPlannedEffortHours(record),

      source: "PROJECT_TRACK" as const,
    }));
}
