import type { EmployeeMonthAvailability } from "../types/domain";

import type { ResourceReleaseType } from "../constants/resourcePlanning";

import { addMonths, compareMonthKeys } from "./monthService";

import { getAllocationReleaseEvents } from "./allocationReleaseService";

export interface ResourceReleaseEvent {
  employeeId: string;
  employeeName: string;
  fromMonthKey: string;
  monthKey: string;
  previousAvailableHours: number;
  availableHours: number;
  releasedHours: number;
  allocationReductionHours: number;
  type: ResourceReleaseType;
}

export interface ExpectedResourceRelease {
  employeeId: string;
  employeeName: string;
  focusMonth: string;
  currentAvailableHours: number;
  nextCapacityIncreaseMonth: string | null;
  nextCapacityIncreaseHours: number;
  fullAvailabilityMonth: string | null;
  releaseEvents: ResourceReleaseEvent[];
  releaseContext: string;
}

export interface ResourceReleaseForecastRow {
  monthKey: string;
  resourcesReleasing: number;
  capacityReleasedHours: number;
  partialReleaseCount: number;
  fullReleaseCount: number;
  allocationReductionHours: number;
  resourcesWithReducedAllocations: number;
}

function isFullyAvailable(record: EmployeeMonthAvailability): boolean {
  return (
    record.workforceState === "ACTIVE" &&
    record.totalCapacityHours > 0 &&
    record.allocatedHours === 0 &&
    record.status === "AVAILABLE"
  );
}

function groupByEmployee(
  records: readonly EmployeeMonthAvailability[],
): Map<string, EmployeeMonthAvailability[]> {
  const groups = new Map<string, EmployeeMonthAvailability[]>();

  for (const record of records) {
    const group = groups.get(record.employeeId) ?? [];

    if (group.some((item) => item.monthKey === record.monthKey)) {
      throw new Error(
        `Duplicate employee-month: ${record.employeeId}/${record.monthKey}`,
      );
    }

    group.push(record);
    groups.set(record.employeeId, group);
  }

  for (const group of groups.values()) {
    group.sort((a, b) => compareMonthKeys(a.monthKey, b.monthKey));
  }

  return groups;
}

export function getCapacityGains(
  records: readonly EmployeeMonthAvailability[],
): ResourceReleaseEvent[] {
  const events: ResourceReleaseEvent[] = [];

  for (const group of groupByEmployee(records).values()) {
    for (let index = 1; index < group.length; index++) {
      const previous = group[index - 1];
      const current = group[index];

      if (
        previous.workforceState !== "ACTIVE" ||
        current.workforceState !== "ACTIVE" ||
        addMonths(previous.monthKey, 1) !== current.monthKey
      ) {
        continue;
      }

      const gain = current.availableHours - previous.availableHours;

      if (gain <= 0) {
        continue;
      }

      const allocationReduction = Math.max(
        0,
        previous.allocatedHours - current.allocatedHours,
      );

      const fullRelease =
        !isFullyAvailable(previous) && isFullyAvailable(current);

      events.push({
        employeeId: current.employeeId,
        employeeName: current.employeeName,
        fromMonthKey: previous.monthKey,
        monthKey: current.monthKey,
        previousAvailableHours: previous.availableHours,
        availableHours: current.availableHours,
        releasedHours: gain,
        allocationReductionHours: allocationReduction,
        type: fullRelease ? "FULL_RELEASE" : "PARTIAL_RELEASE",
      });
    }
  }

  return events.sort(
    (a, b) =>
      compareMonthKeys(a.monthKey, b.monthKey) ||
      b.releasedHours - a.releasedHours ||
      a.employeeName.localeCompare(b.employeeName),
  );
}

export function getFullAvailabilityMonth(
  records: readonly EmployeeMonthAvailability[],
  employeeId: string,
  focusMonth: string,
): string | null {
  return (
    records
      .filter(
        (record) =>
          record.employeeId === employeeId &&
          compareMonthKeys(record.monthKey, focusMonth) >= 0 &&
          isFullyAvailable(record),
      )
      .sort((a, b) => compareMonthKeys(a.monthKey, b.monthKey))[0]?.monthKey ??
    null
  );
}

export function getExpectedRelease(
  records: readonly EmployeeMonthAvailability[],
  employeeId: string,
  focusMonth: string,
): ExpectedResourceRelease | null {
  const employeeRecords = records
    .filter((record) => record.employeeId === employeeId)
    .sort((a, b) => compareMonthKeys(a.monthKey, b.monthKey));

  const current = employeeRecords.find(
    (record) => record.monthKey === focusMonth,
  );

  if (!current) {
    return null;
  }

  const events = getCapacityGains(employeeRecords).filter(
    (event) => compareMonthKeys(event.monthKey, focusMonth) > 0,
  );

  const nextEvent = events[0] ?? null;

  const fullAvailabilityMonth = getFullAvailabilityMonth(
    employeeRecords,
    employeeId,
    focusMonth,
  );

  let releaseContext: string;

  if (isFullyAvailable(current)) {
    releaseContext = "Fully available in the focus month.";
  } else if (nextEvent) {
    releaseContext =
      `Available capacity increases by ${nextEvent.releasedHours}h ` +
      `in ${nextEvent.monthKey}.`;

    if (nextEvent.allocationReductionHours > 0) {
      releaseContext +=
        ` Planned allocations decrease by ` +
        `${nextEvent.allocationReductionHours}h.`;
    }
  } else {
    releaseContext =
      "No future capacity increase identified in the known planning horizon.";
  }

  return {
    employeeId,
    employeeName: current.employeeName,
    focusMonth,
    currentAvailableHours: current.availableHours,
    nextCapacityIncreaseMonth: nextEvent?.monthKey ?? null,
    nextCapacityIncreaseHours: nextEvent?.releasedHours ?? 0,
    fullAvailabilityMonth,
    releaseEvents: events,
    releaseContext,
  };
}

export function getResourceReleaseForecast(
  records: readonly EmployeeMonthAvailability[],
): ResourceReleaseForecastRow[] {
  const capacityEvents = getCapacityGains(records);

  const allocationEvents = getAllocationReleaseEvents(records);

  const months = [...new Set(records.map((record) => record.monthKey))].sort(
    compareMonthKeys,
  );

  return months.map((monthKey) => {
    const monthCapacityEvents = capacityEvents.filter(
      (event) => event.monthKey === monthKey,
    );

    const monthAllocationEvents = allocationEvents.filter(
      (event) => event.monthKey === monthKey,
    );

    return {
      monthKey,

      resourcesReleasing: new Set(
        monthCapacityEvents.map((event) => event.employeeId),
      ).size,

      capacityReleasedHours: monthCapacityEvents.reduce(
        (total, event) => total + event.releasedHours,
        0,
      ),

      partialReleaseCount: monthCapacityEvents.filter(
        (event) => event.type === "PARTIAL_RELEASE",
      ).length,

      fullReleaseCount: monthCapacityEvents.filter(
        (event) => event.type === "FULL_RELEASE",
      ).length,

      allocationReductionHours: monthAllocationEvents.reduce(
        (total, event) => total + event.allocationReductionHours,
        0,
      ),

      resourcesWithReducedAllocations: new Set(
        monthAllocationEvents.map((event) => event.employeeId),
      ).size,
    };
  });
}
