import type { UnassignedDemandRecord } from "../types/demand";
import type { ResourceMonthlyRecord } from "../types/resourceMonthly";

import type {
  AvailabilityDetailData,
  AvailabilityDimension,
  AvailabilityFilters,
  AvailabilityHierarchyPathItem,
  AvailabilityMatrixMetric,
  AvailabilityMatrixRow,
  AvailabilitySummaryData,
} from "../types/availabilityExplorer";

import { FAMSTACK_MONTHS, PROJECT_TRACK_MONTHS } from "../constants/poc";

import { aggregateResourceRecords } from "./aggregationService";

/*
 * Availability Explorer supports the complete
 * historical + planning horizon.
 *
 * Historical:
 * Jan-Aug 2026
 *
 * Planning:
 * Sep 2026-Mar 2027
 *
 * The month list is derived from the centralized
 * POC constants rather than hard-coded calendar
 * values so the Explorer stays aligned with the
 * rest of Resource Vision.
 */
export const AVAILABILITY_MONTHS = [
  ...FAMSTACK_MONTHS,
  ...PROJECT_TRACK_MONTHS,
] as const;

export const AVAILABILITY_HIERARCHY: AvailabilityDimension[] = [
  "primary_capability",
  "secondary_capability",
  "department",
  "grade",
  "country",
  "location",
  "employee",
];

export const DIMENSION_LABELS: Record<AvailabilityDimension, string> = {
  primary_capability: "Primary Capability",
  secondary_capability: "Secondary Capability",
  department: "Department",
  grade: "Grade",
  country: "Country",
  location: "Location",
  employee: "Employee",
};

function getDimensionValue(
  record: ResourceMonthlyRecord,
  dimension: AvailabilityDimension,
): string {
  switch (dimension) {
    case "primary_capability":
      return record.primary_capability;

    case "secondary_capability":
      return record.secondary_capability;

    case "department":
      return record.department;

    case "grade":
      return record.grade;

    case "country":
      return record.country;

    case "location":
      return record.location;

    case "employee":
      return record.employee_name;
  }
}

function getFilterValue(
  filters: AvailabilityFilters,
  dimension: AvailabilityDimension,
): string | undefined {
  switch (dimension) {
    case "primary_capability":
      return filters.primaryCapability;

    case "secondary_capability":
      return filters.secondaryCapability;

    case "department":
      return filters.department;

    case "grade":
      return filters.grade;

    case "country":
      return filters.country;

    case "location":
      return filters.location;

    case "employee":
      return undefined;
  }
}

export function filterAvailabilityRecords(
  records: ResourceMonthlyRecord[],
  filters: AvailabilityFilters,
): ResourceMonthlyRecord[] {
  return records.filter((record) => {
    if (filters.month !== undefined && record.month_key !== filters.month) {
      return false;
    }

    if (
      filters.primaryCapability !== undefined &&
      record.primary_capability !== filters.primaryCapability
    ) {
      return false;
    }

    if (
      filters.secondaryCapability !== undefined &&
      record.secondary_capability !== filters.secondaryCapability
    ) {
      return false;
    }

    if (
      filters.department !== undefined &&
      record.department !== filters.department
    ) {
      return false;
    }

    if (filters.grade !== undefined && record.grade !== filters.grade) {
      return false;
    }

    if (filters.country !== undefined && record.country !== filters.country) {
      return false;
    }

    if (
      filters.location !== undefined &&
      record.location !== filters.location
    ) {
      return false;
    }

    return true;
  });
}

export function getEffectiveHierarchy(
  filters: AvailabilityFilters,
): AvailabilityDimension[] {
  return AVAILABILITY_HIERARCHY.filter(
    (dimension) => getFilterValue(filters, dimension) === undefined,
  );
}

function getSortedUniqueValues(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim() !== ""))].sort(
    (left, right) => left.localeCompare(right),
  );
}

export interface AvailabilityFilterOptions {
  months: readonly string[];

  primaryCapabilities: string[];

  secondaryCapabilities: string[];

  departments: string[];

  grades: string[];

  countries: string[];

  locations: string[];
}

export function getAvailabilityFilterOptions(
  records: ResourceMonthlyRecord[],
  filters: AvailabilityFilters,
): AvailabilityFilterOptions {
  const withoutPrimary = filterAvailabilityRecords(records, {
    ...filters,
    primaryCapability: undefined,
  });

  const withoutSecondary = filterAvailabilityRecords(records, {
    ...filters,
    secondaryCapability: undefined,
  });

  const withoutDepartment = filterAvailabilityRecords(records, {
    ...filters,
    department: undefined,
  });

  const withoutGrade = filterAvailabilityRecords(records, {
    ...filters,
    grade: undefined,
  });

  const withoutCountry = filterAvailabilityRecords(records, {
    ...filters,
    country: undefined,
  });

  const withoutLocation = filterAvailabilityRecords(records, {
    ...filters,
    location: undefined,
  });

  return {
    months: AVAILABILITY_MONTHS,

    primaryCapabilities: getSortedUniqueValues(
      withoutPrimary.map((record) => record.primary_capability),
    ),

    secondaryCapabilities: getSortedUniqueValues(
      withoutSecondary.map((record) => record.secondary_capability),
    ),

    departments: getSortedUniqueValues(
      withoutDepartment.map((record) => record.department),
    ),

    grades: getSortedUniqueValues(withoutGrade.map((record) => record.grade)),

    countries: getSortedUniqueValues(
      withoutCountry.map((record) => record.country),
    ),

    locations: getSortedUniqueValues(
      withoutLocation.map((record) => record.location),
    ),
  };
}

function buildMetric(
  records: ResourceMonthlyRecord[],
): AvailabilityMatrixMetric {
  const aggregate = aggregateResourceRecords(records);

  return {
    totalCapacity: aggregate.totalCapacity,

    utilizedCapacity: aggregate.utilizedCapacity,

    availableCapacity: aggregate.availableCapacity,

    availabilityPercentage: aggregate.availabilityPercentage,

    resourceCount: new Set(records.map((record) => record.employee_id)).size,
  };
}

function createPathId(path: AvailabilityHierarchyPathItem[]): string {
  return path
    .map((item) => `${item.dimension}:${encodeURIComponent(item.value)}`)
    .join("|");
}

function matchesPath(
  record: ResourceMonthlyRecord,
  path: AvailabilityHierarchyPathItem[],
): boolean {
  return path.every(
    (item) => getDimensionValue(record, item.dimension) === item.value,
  );
}

function getRowMonths(filters: AvailabilityFilters): string[] {
  return filters.month !== undefined
    ? [filters.month]
    : [...AVAILABILITY_MONTHS];
}

function buildRow(
  records: ResourceMonthlyRecord[],
  dimension: AvailabilityDimension,
  value: string,
  path: AvailabilityHierarchyPathItem[],
  depth: number,
  hierarchy: AvailabilityDimension[],
  filters: AvailabilityFilters,
): AvailabilityMatrixRow {
  const rowPath = [
    ...path,
    {
      dimension,
      value,
    },
  ];

  const rowRecords = records.filter((record) => matchesPath(record, rowPath));

  const monthlyMetrics: Record<string, AvailabilityMatrixMetric | undefined> =
    {};

  for (const monthKey of getRowMonths(filters)) {
    const monthRecords = rowRecords.filter(
      (record) => record.month_key === monthKey,
    );

    if (monthRecords.length > 0) {
      monthlyMetrics[monthKey] = buildMetric(monthRecords);
    }
  }

  const currentHierarchyIndex = hierarchy.indexOf(dimension);

  return {
    id: createPathId(rowPath),

    label: value,

    dimension,

    depth,

    path: rowPath,

    expandable:
      currentHierarchyIndex >= 0 &&
      currentHierarchyIndex < hierarchy.length - 1,

    employeeId:
      dimension === "employee" ? rowRecords[0]?.employee_id : undefined,

    records: rowRecords,

    monthlyMetrics,

    resourceCount: new Set(rowRecords.map((record) => record.employee_id)).size,
  };
}

function getGroupValues(
  records: ResourceMonthlyRecord[],
  dimension: AvailabilityDimension,
  path: AvailabilityHierarchyPathItem[],
): string[] {
  const scopedRecords = records.filter((record) => matchesPath(record, path));

  return getSortedUniqueValues(
    scopedRecords.map((record) => getDimensionValue(record, dimension)),
  );
}

export function buildVisibleAvailabilityRows(
  records: ResourceMonthlyRecord[],
  filters: AvailabilityFilters,
  expandedRowIds: Set<string>,
): AvailabilityMatrixRow[] {
  const filteredRecords = filterAvailabilityRecords(records, filters);

  const hierarchy = getEffectiveHierarchy(filters);

  if (filteredRecords.length === 0 || hierarchy.length === 0) {
    return [];
  }

  const rows: AvailabilityMatrixRow[] = [];

  function appendLevel(
    dimensionIndex: number,
    path: AvailabilityHierarchyPathItem[],
    depth: number,
  ): void {
    const dimension = hierarchy[dimensionIndex];

    if (dimension === undefined) {
      return;
    }

    const values = getGroupValues(filteredRecords, dimension, path);

    for (const value of values) {
      const row = buildRow(
        filteredRecords,
        dimension,
        value,
        path,
        depth,
        hierarchy,
        filters,
      );

      rows.push(row);

      if (row.expandable && expandedRowIds.has(row.id)) {
        appendLevel(dimensionIndex + 1, row.path, depth + 1);
      }
    }
  }

  appendLevel(0, [], 0);

  return rows;
}

export function getAvailabilitySummary(
  records: ResourceMonthlyRecord[],
  filters: AvailabilityFilters,
): AvailabilitySummaryData {
  const filtered = filterAvailabilityRecords(records, filters);

  const aggregate = aggregateResourceRecords(filtered);

  return {
    resourceCount: new Set(filtered.map((record) => record.employee_id)).size,

    totalCapacity: aggregate.totalCapacity,

    utilizedCapacity: aggregate.utilizedCapacity,

    availableCapacity: aggregate.availableCapacity,

    availabilityPercentage: aggregate.availabilityPercentage,
  };
}

function demandMatchesPath(
  demand: UnassignedDemandRecord,
  path: AvailabilityHierarchyPathItem[],
): boolean {
  return path.every((item) => {
    switch (item.dimension) {
      case "primary_capability":
        return demand.primary_capability === item.value;

      case "secondary_capability":
        return demand.secondary_capability === item.value;

      case "department":
        return demand.department === item.value;

      case "grade":
        return demand.grade === item.value;

      case "country":
        return demand.country === item.value;

      case "location":
        return demand.location === item.value;

      case "employee":
        return false;
    }
  });
}

function demandMatchesFilters(
  demand: UnassignedDemandRecord,
  filters: AvailabilityFilters,
): boolean {
  if (filters.month !== undefined && demand.month_key !== filters.month) {
    return false;
  }

  if (
    filters.primaryCapability !== undefined &&
    demand.primary_capability !== filters.primaryCapability
  ) {
    return false;
  }

  if (
    filters.secondaryCapability !== undefined &&
    demand.secondary_capability !== filters.secondaryCapability
  ) {
    return false;
  }

  if (
    filters.department !== undefined &&
    demand.department !== filters.department
  ) {
    return false;
  }

  if (filters.grade !== undefined && demand.grade !== filters.grade) {
    return false;
  }

  if (filters.country !== undefined && demand.country !== filters.country) {
    return false;
  }

  if (filters.location !== undefined && demand.location !== filters.location) {
    return false;
  }

  return true;
}

export function getFilteredUnassignedDemand(
  demandRecords: UnassignedDemandRecord[],
  filters: AvailabilityFilters,
): UnassignedDemandRecord[] {
  return demandRecords.filter((demand) =>
    demandMatchesFilters(demand, filters),
  );
}

export function getAvailabilityCellDetail(
  row: AvailabilityMatrixRow,
  monthKey: string,
  demandRecords: UnassignedDemandRecord[],
  filters: AvailabilityFilters,
): AvailabilityDetailData | null {
  const monthRecords = row.records.filter(
    (record) => record.month_key === monthKey,
  );

  if (monthRecords.length === 0) {
    return null;
  }

  const metrics = buildMetric(monthRecords);

  const source = monthRecords[0].source;

  const relevantDemand =
    row.dimension === "employee"
      ? []
      : demandRecords.filter(
          (demand) =>
            demand.month_key === monthKey &&
            demandMatchesFilters(demand, filters) &&
            demandMatchesPath(demand, row.path),
        );

  const unassignedDemandHours = relevantDemand.reduce(
    (total, demand) => total + demand.effort_hours,
    0,
  );

  const resources = [...monthRecords].sort(
    (left, right) => right.available_capacity - left.available_capacity,
  );

  return {
    title: row.label,

    monthKey,

    source,

    dimension: row.dimension,

    employeeId: row.employeeId,

    metrics,

    resources,

    unassignedDemand: relevantDemand,

    unassignedDemandHours,
  };
}
