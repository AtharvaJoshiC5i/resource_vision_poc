import type {
  ResourceMonthlyRecord,
  ResourceRecordFilters,
} from "../types/resourceMonthly";

export function filterResourceRecords(
  records: ResourceMonthlyRecord[],
  filters: ResourceRecordFilters,
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

    if (
      filters.employeeId !== undefined &&
      record.employee_id !== filters.employeeId
    ) {
      return false;
    }

    return true;
  });
}

export function getSortedUniqueValues(
  records: ResourceMonthlyRecord[],
  selector: (record: ResourceMonthlyRecord) => string,
): string[] {
  return [
    ...new Set(records.map(selector).filter((value) => value.trim() !== "")),
  ].sort((a, b) => a.localeCompare(b));
}

export function getResourceDimensions(records: ResourceMonthlyRecord[]) {
  return {
    primaryCapabilities: getSortedUniqueValues(
      records,
      (record) => record.primary_capability,
    ),

    secondaryCapabilities: getSortedUniqueValues(
      records,
      (record) => record.secondary_capability,
    ),

    departments: getSortedUniqueValues(records, (record) => record.department),

    grades: getSortedUniqueValues(records, (record) => record.grade),

    countries: getSortedUniqueValues(records, (record) => record.country),

    locations: getSortedUniqueValues(records, (record) => record.location),
  };
}
