import type { EmployeeMonthAvailability } from "../types/domain";

import type {
  AvailabilityDimensionAggregate,
  AvailabilityDimensionMonthAggregate,
  ResourceDimension,
} from "../types/resourceFilters";

import { getOperationalAvailableHours } from "./resourceFilterService";

function getDimensionValue(
  record: EmployeeMonthAvailability,
  dimension: ResourceDimension,
): string {
  return record[dimension].trim() || "Unspecified";
}

export function aggregateAvailabilityByDimension(
  records: EmployeeMonthAvailability[],

  dimension: ResourceDimension,

  monthKey: string,
): AvailabilityDimensionAggregate[] {
  const monthRecords = records.filter((record) => record.monthKey === monthKey);

  const groups = new Map<string, EmployeeMonthAvailability[]>();

  for (const record of monthRecords) {
    const key = getDimensionValue(record, dimension);

    const existing = groups.get(key) ?? [];

    existing.push(record);

    groups.set(key, existing);
  }

  return [...groups.entries()]
    .map(([key, group]) => ({
      key,

      totalResources: group.length,

      resourcesWithCapacity: group.filter(
        (record) => getOperationalAvailableHours(record) > 0,
      ).length,

      fullyAvailableResources: group.filter(
        (record) => record.status === "AVAILABLE",
      ).length,

      partiallyAvailableResources: group.filter(
        (record) => record.status === "PARTIALLY_AVAILABLE",
      ).length,

      fullyAllocatedResources: group.filter(
        (record) => record.status === "FULLY_ALLOCATED",
      ).length,

      overAllocatedResources: group.filter(
        (record) => record.status === "OVER_ALLOCATED",
      ).length,

      totalCapacityHours: group.reduce(
        (total, record) => total + record.totalCapacityHours,
        0,
      ),

      allocatedHours: group.reduce(
        (total, record) => total + record.allocatedHours,
        0,
      ),

      availableHours: group.reduce(
        (total, record) =>
          total + Math.max(getOperationalAvailableHours(record), 0),
        0,
      ),
    }))
    .sort(
      (left, right) =>
        right.availableHours - left.availableHours ||
        left.key.localeCompare(right.key),
    );
}

export function aggregateAvailabilityByDimensionAcrossMonths(
  records: EmployeeMonthAvailability[],

  dimension: ResourceDimension,

  monthKeys: string[],
): AvailabilityDimensionMonthAggregate[] {
  const allKeys = new Set<string>();

  for (const record of records) {
    allKeys.add(getDimensionValue(record, dimension));
  }

  return [...allKeys]
    .sort((left, right) => left.localeCompare(right))
    .map((key) => ({
      key,

      months: monthKeys.map((monthKey) => {
        const matching = records.filter(
          (record) =>
            record.monthKey === monthKey &&
            getDimensionValue(record, dimension) === key,
        );

        return {
          monthKey,

          totalResources: matching.length,

          resourcesWithCapacity: matching.filter(
            (record) => getOperationalAvailableHours(record) > 0,
          ).length,

          availableHours: matching.reduce(
            (total, record) =>
              total + Math.max(getOperationalAvailableHours(record), 0),
            0,
          ),
        };
      }),
    }));
}
