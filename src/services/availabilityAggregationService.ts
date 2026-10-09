import type {
  EmployeeMonthAvailability,
  MonthlyAvailabilitySummary,
} from "../types/domain";

export function getMonthlyAvailabilitySummary(
  records: EmployeeMonthAvailability[],
  monthKey: string,
): MonthlyAvailabilitySummary {
  const monthRecords = records.filter(
    (record) =>
      record.monthKey === monthKey && record.workforceState === "ACTIVE",
  );

  return {
    monthKey,

    totalResources: monthRecords.length,

    resourcesWithCapacity: monthRecords.filter(
      (record) => record.availableHours > 0,
    ).length,

    fullyAvailableResources: monthRecords.filter(
      (record) => record.status === "AVAILABLE",
    ).length,

    partiallyAvailableResources: monthRecords.filter(
      (record) => record.status === "PARTIALLY_AVAILABLE",
    ).length,

    fullyAllocatedResources: monthRecords.filter(
      (record) => record.status === "FULLY_ALLOCATED",
    ).length,

    overAllocatedResources: monthRecords.filter(
      (record) => record.status === "OVER_ALLOCATED",
    ).length,

    totalCapacityHours: monthRecords.reduce(
      (total, record) => total + record.totalCapacityHours,
      0,
    ),

    totalAllocatedHours: monthRecords.reduce(
      (total, record) => total + record.allocatedHours,
      0,
    ),

    /*
     * Organizational "Available Hours" represents
     * usable positive capacity.
     *
     * An over-allocated employee keeps their
     * negative availableHours on their individual
     * record, but that negative value must not
     * reduce another employee's usable capacity.
     */
    totalAvailableHours: monthRecords.reduce(
      (total, record) => total + Math.max(record.availableHours, 0),
      0,
    ),

    /*
     * Same aggregation convention for the future
     * available-to-promise measure.
     *
     * In Phase 3 blockedHours remains zero, so this
     * currently equals positive available capacity.
     */
    totalAvailableToPromiseHours: monthRecords.reduce(
      (total, record) => total + Math.max(record.availableToPromiseHours, 0),
      0,
    ),
  };
}
