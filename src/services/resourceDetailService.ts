import type { FamstackRecord } from "../types/famstack";

import type { ProjectTrackRecord } from "../types/projectTrack";

import type { ResourceMonthlyRecord } from "../types/resourceMonthly";

import type { ZingHREmployee } from "../types/zinghr";

import type {
  HistoricalActivityRow,
  ResourceDetailViewModel,
  ResourceEmployeeDetail,
  ResourceProjectAllocation,
  ResourceReconciliationIssue,
} from "../types/resourceDetail";

import { POC_CURRENT_MONTH, PROJECT_TRACK_MONTHS } from "../constants/poc";

/*
 * Resource Detail outlook follows the same centralized
 * planning-month definition used by the rest of the app.
 *
 * After the Phase 8 extension this becomes:
 *
 * Sep 2026
 * Oct 2026
 * Nov 2026
 * Dec 2026
 * Jan 2027
 * Feb 2027
 * Mar 2027
 */
const OUTLOOK_MONTHS = [...PROJECT_TRACK_MONTHS] as readonly string[];

function compareMonthKeys(left: string, right: string): number {
  return left.localeCompare(right);
}

function createEmployeeDetail(
  employee: ZingHREmployee,
): ResourceEmployeeDetail {
  return {
    employeeId: employee.employee_id,

    employeeName: employee.employee_name,

    primaryCapability: employee.primary_capability,

    secondaryCapability: employee.secondary_capability,

    department: employee.department,

    grade: employee.grade,

    location: employee.location,

    country: employee.country,

    employmentStatus: employee.employment_status,

    dateOfJoining: employee.date_of_joining,

    dateOfLeaving:
      employee.date_of_leaving.trim() === ""
        ? undefined
        : employee.date_of_leaving,
  };
}

export function getResourceTimeline(
  records: ResourceMonthlyRecord[],
  employeeId: string,
): ResourceMonthlyRecord[] {
  return records
    .filter((record) => record.employee_id === employeeId)
    .sort((left, right) => compareMonthKeys(left.month_key, right.month_key));
}

export function getResourceOutlook(
  records: ResourceMonthlyRecord[],
  employeeId: string,
): ResourceMonthlyRecord[] {
  const outlookMonthSet = new Set(OUTLOOK_MONTHS);

  return records
    .filter(
      (record) =>
        record.employee_id === employeeId &&
        outlookMonthSet.has(record.month_key),
    )
    .sort((left, right) => compareMonthKeys(left.month_key, right.month_key));
}

export function getFutureAllocations(
  records: ProjectTrackRecord[],
  employeeId: string,
): ResourceProjectAllocation[] {
  /*
   * Project Track is the current/future planning
   * source from the fixed POC current month onward.
   */
  const employeeRecords = records.filter(
    (record) =>
      record.employee_id === employeeId &&
      record.employee_tagging === "TAGGED" &&
      record.month_key >= POC_CURRENT_MONTH,
  );

  const groups = new Map<string, ProjectTrackRecord[]>();

  for (const record of employeeRecords) {
    const key =
      record.project_id || record.proposal_number || record.project_name;

    const existing = groups.get(key) ?? [];

    existing.push(record);

    groups.set(key, existing);
  }

  /*
   * Build a strongly typed result explicitly.
   *
   * This avoids the previous
   * `(ResourceProjectAllocation | null)[]`
   * intermediate type and therefore removes
   * the type-predicate and nullable-sort errors.
   */
  const futureAllocations: ResourceProjectAllocation[] = [];

  for (const projectRecords of groups.values()) {
    const sortedProjectRecords = [...projectRecords].sort((left, right) =>
      compareMonthKeys(left.month_key, right.month_key),
    );

    const first = sortedProjectRecords[0];

    if (first === undefined) {
      continue;
    }

    const monthTotals = new Map<string, number>();

    for (const record of sortedProjectRecords) {
      monthTotals.set(
        record.month_key,
        (monthTotals.get(record.month_key) ?? 0) + record.effort_value,
      );
    }

    const months = [...monthTotals.entries()]
      .map(([monthKey, effortHours]) => ({
        monthKey,
        effortHours,
      }))
      .sort((left, right) => compareMonthKeys(left.monthKey, right.monthKey));

    const project: ResourceProjectAllocation = {
      projectId: first.project_id,

      proposalNumber: first.proposal_number,

      projectName: first.project_name,

      projectStatus: first.project_status,

      contractType: first.contract_type,

      months,

      totalEffortHours: months.reduce(
        (total, month) => total + month.effortHours,
        0,
      ),
    };

    futureAllocations.push(project);
  }

  return futureAllocations.sort((left, right) =>
    left.projectName.localeCompare(right.projectName),
  );
}

export function getHistoricalActivity(
  records: FamstackRecord[],
  employeeId: string,
): HistoricalActivityRow[] {
  return records
    .filter((record) => record.employee_id === employeeId)
    .map((record) => ({
      monthKey: record.month_key,

      projectId: record.project_id,

      projectName: record.project_name,

      workCategory: record.work_category,

      actualEffortHours: record.actual_effort_hours,
    }))
    .sort((left, right) => {
      const monthComparison = compareMonthKeys(left.monthKey, right.monthKey);

      if (monthComparison !== 0) {
        return monthComparison;
      }

      return left.projectName.localeCompare(right.projectName);
    });
}

function getReconciliationIssues(
  employeeId: string,
  timeline: ResourceMonthlyRecord[],
  famstackRecords: FamstackRecord[],
  projectTrackRecords: ProjectTrackRecord[],
): ResourceReconciliationIssue[] {
  const issues: ResourceReconciliationIssue[] = [];

  for (const record of timeline) {
    let sourceUtilization = 0;

    if (record.source === "FAMSTACK") {
      sourceUtilization = famstackRecords
        .filter(
          (sourceRecord) =>
            sourceRecord.employee_id === employeeId &&
            sourceRecord.month_key === record.month_key,
        )
        .reduce(
          (total, sourceRecord) => total + sourceRecord.actual_effort_hours,
          0,
        );
    } else {
      sourceUtilization = projectTrackRecords
        .filter(
          (sourceRecord) =>
            sourceRecord.employee_id === employeeId &&
            sourceRecord.month_key === record.month_key &&
            sourceRecord.employee_tagging === "TAGGED",
        )
        .reduce((total, sourceRecord) => total + sourceRecord.effort_value, 0);
    }

    if (Math.abs(sourceUtilization - record.utilized_capacity) > 0.01) {
      issues.push({
        monthKey: record.month_key,

        source: record.source,

        normalizedUtilization: record.utilized_capacity,

        sourceUtilization,
      });
    }
  }

  return issues;
}

export interface GetResourceDetailInput {
  employeeId: string;

  employees: ZingHREmployee[];

  monthlyRecords: ResourceMonthlyRecord[];

  famstackRecords: FamstackRecord[];

  projectTrackRecords: ProjectTrackRecord[];
}

export function getResourceDetail({
  employeeId,
  employees,
  monthlyRecords,
  famstackRecords,
  projectTrackRecords,
}: GetResourceDetailInput): ResourceDetailViewModel | null {
  const employee = employees.find(
    (candidate) => candidate.employee_id === employeeId,
  );

  if (employee === undefined) {
    return null;
  }

  const timeline = getResourceTimeline(monthlyRecords, employeeId);

  const currentSnapshot =
    timeline.find((record) => record.month_key === POC_CURRENT_MONTH) ?? null;

  const outlook = getResourceOutlook(monthlyRecords, employeeId);

  const futureAllocations = getFutureAllocations(
    projectTrackRecords,
    employeeId,
  );

  const historicalActivity = getHistoricalActivity(famstackRecords, employeeId);

  const reconciliationIssues = getReconciliationIssues(
    employeeId,
    timeline,
    famstackRecords,
    projectTrackRecords,
  );

  return {
    employee: createEmployeeDetail(employee),

    currentSnapshot,

    timeline,

    outlook,

    futureAllocations,

    historicalActivity,

    reconciliationIssues,
  };
}

export function logResourceDetailReconciliation(
  detail: ResourceDetailViewModel,
): void {
  if (detail.reconciliationIssues.length === 0) {
    return;
  }

  for (const issue of detail.reconciliationIssues) {
    console.warn(
      `[Resource Vision] Resource reconciliation mismatch for ${detail.employee.employeeId}, ${issue.monthKey}. Normalized=${issue.normalizedUtilization}, ${issue.source}=${issue.sourceUtilization}.`,
    );
  }
}
