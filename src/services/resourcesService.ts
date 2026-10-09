import type {
  AvailabilityStatus,
  ResourceMonthlyRecord,
} from "../types/resourceMonthly";

import type {
  ResourceFilterOptions,
  ResourceFilters,
  ResourceOutlookMonth,
  ResourceSort,
  ResourceSummaryData,
  ResourceTableRow,
} from "../types/resources";

import { FAMSTACK_MONTHS, PROJECT_TRACK_MONTHS } from "../constants/poc";

/*
 * Complete resource month coverage.
 *
 * Historical:
 * Jan 2026 -> Aug 2026
 *
 * Planning:
 * Sep 2026 -> Mar 2027
 *
 * This replaces the previous hard-coded
 * Jan 2026 -> Dec 2026 list.
 */
export const RESOURCE_MONTHS = [
  ...FAMSTACK_MONTHS,
  ...PROJECT_TRACK_MONTHS,
] as const;

/*
 * Forward-looking resource outlook.
 *
 * This is intentionally based on the centralized
 * Project Track planning months so the Resource
 * page automatically follows the same horizon as
 * Availability.
 *
 * Sep 2026
 * Oct 2026
 * Nov 2026
 * Dec 2026
 * Jan 2027
 * Feb 2027
 * Mar 2027
 */
export const RESOURCE_OUTLOOK_MONTHS = [...PROJECT_TRACK_MONTHS] as const;

function getSortedUniqueValues(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim() !== ""))].sort(
    (left, right) => left.localeCompare(right),
  );
}

function getEmployeeOutlook(
  records: ResourceMonthlyRecord[],
  employeeId: string,
): ResourceTableRow["outlook"] {
  const outlook: ResourceTableRow["outlook"] = {};

  for (const monthKey of RESOURCE_OUTLOOK_MONTHS) {
    const record = records.find(
      (candidate) =>
        candidate.employee_id === employeeId &&
        candidate.month_key === monthKey,
    );

    if (record === undefined) {
      continue;
    }

    const month: ResourceOutlookMonth = {
      monthKey,

      availabilityPercentage: record.availability_percentage,

      availableCapacity: record.available_capacity,

      status: record.availability_status,
    };

    outlook[monthKey] = month;
  }

  return outlook;
}

export function getResourceRowsForMonth(
  records: ResourceMonthlyRecord[],
  monthKey: string,
): ResourceTableRow[] {
  const monthRecords = records.filter(
    (record) => record.month_key === monthKey,
  );

  return monthRecords.map((record) => ({
    employeeId: record.employee_id,

    employeeName: record.employee_name,

    primaryCapability: record.primary_capability,

    secondaryCapability: record.secondary_capability,

    department: record.department,

    grade: record.grade,

    location: record.location,

    country: record.country,

    totalCapacity: record.total_capacity,

    utilizedCapacity: record.utilized_capacity,

    availableCapacity: record.available_capacity,

    availabilityPercentage: record.availability_percentage,

    availabilityStatus: record.availability_status,

    outlook: getEmployeeOutlook(records, record.employee_id),
  }));
}

export function filterResourceRows(
  rows: ResourceTableRow[],
  filters: ResourceFilters,
  searchText: string,
): ResourceTableRow[] {
  const normalizedSearch = searchText.trim().toLocaleLowerCase();

  return rows.filter((row) => {
    if (
      filters.primaryCapability !== undefined &&
      row.primaryCapability !== filters.primaryCapability
    ) {
      return false;
    }

    if (
      filters.secondaryCapability !== undefined &&
      row.secondaryCapability !== filters.secondaryCapability
    ) {
      return false;
    }

    if (
      filters.department !== undefined &&
      row.department !== filters.department
    ) {
      return false;
    }

    if (filters.grade !== undefined && row.grade !== filters.grade) {
      return false;
    }

    if (filters.country !== undefined && row.country !== filters.country) {
      return false;
    }

    if (filters.location !== undefined && row.location !== filters.location) {
      return false;
    }

    if (
      filters.status !== undefined &&
      row.availabilityStatus !== filters.status
    ) {
      return false;
    }

    if (normalizedSearch !== "") {
      const employeeName = row.employeeName.toLocaleLowerCase();

      const employeeId = row.employeeId.toLocaleLowerCase();

      if (
        !employeeName.includes(normalizedSearch) &&
        !employeeId.includes(normalizedSearch)
      ) {
        return false;
      }
    }

    return true;
  });
}

export function getResourceSummary(
  rows: ResourceTableRow[],
): ResourceSummaryData {
  const totalCapacity = rows.reduce(
    (total, row) => total + row.totalCapacity,
    0,
  );

  const utilizedCapacity = rows.reduce(
    (total, row) => total + row.utilizedCapacity,
    0,
  );

  const availableCapacity = rows.reduce(
    (total, row) => total + row.availableCapacity,
    0,
  );

  const availabilityPercentage =
    totalCapacity === 0
      ? 0
      : Math.round(
          ((availableCapacity / totalCapacity) * 100 + Number.EPSILON) * 100,
        ) / 100;

  return {
    resourceCount: new Set(rows.map((row) => row.employeeId)).size,

    availableResourceCount: rows.filter((row) => row.availableCapacity > 0)
      .length,

    totalCapacity,

    utilizedCapacity,

    availableCapacity,

    availabilityPercentage,

    overAllocatedCount: rows.filter(
      (row) => row.availabilityStatus === "OVER_ALLOCATED",
    ).length,
  };
}

function filterRowsForOptions(
  rows: ResourceTableRow[],
  filters: ResourceFilters,
  excluded:
    | "primaryCapability"
    | "secondaryCapability"
    | "department"
    | "grade"
    | "country"
    | "location",
): ResourceTableRow[] {
  return rows.filter((row) => {
    if (
      excluded !== "primaryCapability" &&
      filters.primaryCapability !== undefined &&
      row.primaryCapability !== filters.primaryCapability
    ) {
      return false;
    }

    if (
      excluded !== "secondaryCapability" &&
      filters.secondaryCapability !== undefined &&
      row.secondaryCapability !== filters.secondaryCapability
    ) {
      return false;
    }

    if (
      excluded !== "department" &&
      filters.department !== undefined &&
      row.department !== filters.department
    ) {
      return false;
    }

    if (
      excluded !== "grade" &&
      filters.grade !== undefined &&
      row.grade !== filters.grade
    ) {
      return false;
    }

    if (
      excluded !== "country" &&
      filters.country !== undefined &&
      row.country !== filters.country
    ) {
      return false;
    }

    if (
      excluded !== "location" &&
      filters.location !== undefined &&
      row.location !== filters.location
    ) {
      return false;
    }

    if (
      filters.status !== undefined &&
      row.availabilityStatus !== filters.status
    ) {
      return false;
    }

    return true;
  });
}

export function getResourceFilterOptions(
  rows: ResourceTableRow[],
  filters: ResourceFilters,
): ResourceFilterOptions {
  return {
    primaryCapabilities: getSortedUniqueValues(
      filterRowsForOptions(rows, filters, "primaryCapability").map(
        (row) => row.primaryCapability,
      ),
    ),

    secondaryCapabilities: getSortedUniqueValues(
      filterRowsForOptions(rows, filters, "secondaryCapability").map(
        (row) => row.secondaryCapability,
      ),
    ),

    departments: getSortedUniqueValues(
      filterRowsForOptions(rows, filters, "department").map(
        (row) => row.department,
      ),
    ),

    grades: getSortedUniqueValues(
      filterRowsForOptions(rows, filters, "grade").map((row) => row.grade),
    ),

    countries: getSortedUniqueValues(
      filterRowsForOptions(rows, filters, "country").map((row) => row.country),
    ),

    locations: getSortedUniqueValues(
      filterRowsForOptions(rows, filters, "location").map(
        (row) => row.location,
      ),
    ),
  };
}

export function sortResourceRows(
  rows: ResourceTableRow[],
  sort: ResourceSort,
): ResourceTableRow[] {
  return [...rows].sort((left, right) => {
    let comparison: number;

    switch (sort.field) {
      case "employeeName":
        comparison = left.employeeName.localeCompare(right.employeeName);
        break;

      case "availableCapacity":
        comparison = left.availableCapacity - right.availableCapacity;
        break;

      case "availabilityPercentage":
        comparison = left.availabilityPercentage - right.availabilityPercentage;
        break;

      case "utilizedCapacity":
        comparison = left.utilizedCapacity - right.utilizedCapacity;
        break;
    }

    return sort.direction === "asc" ? comparison : -comparison;
  });
}

export function isAvailabilityStatus(
  value: string,
): value is AvailabilityStatus {
  return (
    value === "AVAILABLE" ||
    value === "PARTIALLY_AVAILABLE" ||
    value === "FULLY_ALLOCATED" ||
    value === "OVER_ALLOCATED"
  );
}
