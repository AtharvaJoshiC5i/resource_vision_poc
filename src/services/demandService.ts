import type { ProjectTrackRecord } from "../types/projectTrack";
import type { UnassignedDemandRecord } from "../types/demand";

export function getUnassignedDemand(
  records: ProjectTrackRecord[],
): UnassignedDemandRecord[] {
  return records
    .filter((record) => record.employee_tagging === "UNASSIGNED_GRADE_DEMAND")
    .map((record) => ({
      project_id: record.project_id,
      proposal_number: record.proposal_number,
      project_name: record.project_name,

      month_key: record.month_key,

      primary_capability: record.primary_capability,
      secondary_capability: record.secondary_capability,
      department: record.department,
      grade: record.grade,
      location: record.location,
      country: record.country,

      effort_hours: record.effort_value,
    }));
}
