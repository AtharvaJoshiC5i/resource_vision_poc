import type { EmployeeMonthAvailability } from "../types/domain";

import type {
  ResourceAvailabilityMatrixFilters,
  ResourceAvailabilityMatrixRow,
  ResourceAvailabilityMatrixSummary,
  ResourceMatrixProjectSummary,
  ResourceMatrixSort,
} from "../types/resourceAvailabilityMatrix";

import { compareMonthKeys } from "./monthService";

function normalizeSearch(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function getProjectKey(project: ResourceMatrixProjectSummary): string {
  return project.projectId || project.proposalNumber || project.projectName;
}

function buildProjectSummary(
  records: EmployeeMonthAvailability[],
): ResourceMatrixProjectSummary[] {
  const projects = new Map<string, ResourceMatrixProjectSummary>();

  for (const record of records) {
    for (const allocation of record.projectAllocations) {
      const candidate: ResourceMatrixProjectSummary = {
        projectId: allocation.projectId,

        projectName: allocation.projectName,

        proposalNumber: allocation.proposalNumber,

        allocatedHours: allocation.allocatedHours,

        projectStartDate: allocation.projectStartDate,

        projectEndDate: allocation.projectEndDate,
      };

      const key = getProjectKey(candidate);

      const existing = projects.get(key);

      if (existing === undefined) {
        projects.set(key, candidate);

        continue;
      }

      /*
       * Current Projects is a horizon-level
       * contextual summary.
       *
       * Do not sum the same project's hours across
       * months because that would make the column
       * look like a monthly utilization measure.
       *
       * Keep the maximum visible monthly allocation
       * only as lightweight context.
       */
      existing.allocatedHours = Math.max(
        existing.allocatedHours,
        allocation.allocatedHours,
      );

      if (
        allocation.projectStartDate !== undefined &&
        (existing.projectStartDate === undefined ||
          allocation.projectStartDate < existing.projectStartDate)
      ) {
        existing.projectStartDate = allocation.projectStartDate;
      }

      if (
        allocation.projectEndDate !== undefined &&
        (existing.projectEndDate === undefined ||
          allocation.projectEndDate > existing.projectEndDate)
      ) {
        existing.projectEndDate = allocation.projectEndDate;
      }
    }
  }

  return [...projects.values()].sort((left, right) =>
    left.projectName.localeCompare(right.projectName),
  );
}

function getAllocatedUntil(
  projects: ResourceMatrixProjectSummary[],
): string | undefined {
  const endDates = projects
    .map((project) => project.projectEndDate)
    .filter(
      (value): value is string => value !== undefined && value.trim() !== "",
    );

  if (endDates.length === 0) {
    return undefined;
  }

  return endDates.sort((left, right) => left.localeCompare(right))[
    endDates.length - 1
  ];
}

function getFirstFullAvailabilityMonth(
  records: EmployeeMonthAvailability[],
): string | undefined {
  return [...records]
    .sort((left, right) => compareMonthKeys(left.monthKey, right.monthKey))
    .find((record) => record.status === "AVAILABLE")?.monthKey;
}

function getFirstCapacityGainMonth(
  records: EmployeeMonthAvailability[],
): string | undefined {
  const sorted = [...records].sort((left, right) =>
    compareMonthKeys(left.monthKey, right.monthKey),
  );

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];

    const current = sorted[index];

    if (current.availableHours > previous.availableHours) {
      return current.monthKey;
    }
  }

  return undefined;
}

export function buildResourceAvailabilityMatrixRows(
  records: EmployeeMonthAvailability[],
  monthKeys: string[],
  focusMonth: string,
): ResourceAvailabilityMatrixRow[] {
  const recordsByEmployee = new Map<string, EmployeeMonthAvailability[]>();

  for (const record of records) {
    const existing = recordsByEmployee.get(record.employeeId) ?? [];

    existing.push(record);

    recordsByEmployee.set(record.employeeId, existing);
  }

  const rows: ResourceAvailabilityMatrixRow[] = [];

  for (const employeeRecords of recordsByEmployee.values()) {
    const first = employeeRecords[0];

    if (first === undefined) {
      continue;
    }

    const byMonth = new Map(
      employeeRecords.map((record) => [record.monthKey, record]),
    );

    const projects = buildProjectSummary(employeeRecords);

    rows.push({
      employeeId: first.employeeId,

      employeeName: first.employeeName,

      primaryCapability: first.primaryCapability,

      secondaryCapability: first.secondaryCapability,

      department: first.department,

      grade: first.grade,

      location: first.location,

      country: first.country,

      months: monthKeys.map((monthKey) => ({
        monthKey,

        availability: byMonth.get(monthKey) ?? null,
      })),

      projects,

      allocatedUntil: getAllocatedUntil(projects),

      focusMonthAvailability: byMonth.get(focusMonth) ?? null,

      firstFullAvailabilityMonth:
        getFirstFullAvailabilityMonth(employeeRecords),

      firstCapacityGainMonth: getFirstCapacityGainMonth(employeeRecords),
    });
  }

  return rows;
}

export function filterResourceAvailabilityMatrixRows(
  rows: ResourceAvailabilityMatrixRow[],
  filters: ResourceAvailabilityMatrixFilters,
): ResourceAvailabilityMatrixRow[] {
  const search = normalizeSearch(filters.search);

  return rows.filter((row) => {
    if (search !== "") {
      const employeeName = row.employeeName.toLocaleLowerCase();

      const employeeId = row.employeeId.toLocaleLowerCase();

      if (!employeeName.includes(search) && !employeeId.includes(search)) {
        return false;
      }
    }

    if (filters.status === "ALL") {
      return true;
    }

    const focus = row.focusMonthAvailability;

    if (focus === null) {
      return false;
    }

    if (filters.status === "WITH_CAPACITY") {
      return (
        focus.status === "AVAILABLE" || focus.status === "PARTIALLY_AVAILABLE"
      );
    }

    return focus.status === filters.status;
  });
}

function compareOptionalStrings(
  left: string | undefined,
  right: string | undefined,
): number {
  if (left === undefined && right === undefined) {
    return 0;
  }

  if (left === undefined) {
    return 1;
  }

  if (right === undefined) {
    return -1;
  }

  return left.localeCompare(right);
}

export function sortResourceAvailabilityMatrixRows(
  rows: ResourceAvailabilityMatrixRow[],
  sort: ResourceMatrixSort,
): ResourceAvailabilityMatrixRow[] {
  return [...rows].sort((left, right) => {
    let comparison = 0;

    switch (sort.field) {
      case "employeeName":
        comparison = left.employeeName.localeCompare(right.employeeName);
        break;

      case "availableHours":
        comparison =
          (left.focusMonthAvailability?.availableHours ??
            Number.NEGATIVE_INFINITY) -
          (right.focusMonthAvailability?.availableHours ??
            Number.NEGATIVE_INFINITY);
        break;

      case "primaryCapability":
        comparison = left.primaryCapability.localeCompare(
          right.primaryCapability,
        );
        break;

      case "grade":
        comparison = left.grade.localeCompare(right.grade, undefined, {
          numeric: true,
        });
        break;

      case "allocatedUntil":
        comparison = compareOptionalStrings(
          left.allocatedUntil,
          right.allocatedUntil,
        );
        break;
    }

    return sort.direction === "asc" ? comparison : -comparison;
  });
}

export function getResourceAvailabilityMatrixSummary(
  rows: ResourceAvailabilityMatrixRow[],
  focusMonth: string,
): ResourceAvailabilityMatrixSummary {
  const focusRecords = rows
    .map((row) => row.focusMonthAvailability)
    .filter((record): record is EmployeeMonthAvailability => record !== null);

  return {
    totalResources: rows.length,

    resourcesWithCapacity: focusRecords.filter(
      (record) => record.availableHours > 0,
    ).length,

    totalAvailableHours: focusRecords.reduce(
      (total, record) => total + Math.max(record.availableHours, 0),
      0,
    ),

    focusMonth,
  };
}
