import type { EmployeeMonthAvailability } from "../types/domain";

import { addMonths, compareMonthKeys } from "./monthService";

export interface AllocationReleaseEvent {
  employeeId: string;
  employeeName: string;
  fromMonthKey: string;
  monthKey: string;
  previousAllocatedHours: number;
  currentAllocatedHours: number;
  allocationReductionHours: number;
  availableHours: number;
}

export function getAllocationReleaseEvents(
  records: readonly EmployeeMonthAvailability[],
): AllocationReleaseEvent[] {
  const groups = new Map<string, EmployeeMonthAvailability[]>();

  for (const record of records) {
    const group = groups.get(record.employeeId) ?? [];

    if (group.some((item) => item.monthKey === record.monthKey)) {
      throw new Error(
        `Duplicate employee-month record: ${record.employeeId}/${record.monthKey}`,
      );
    }

    group.push(record);
    groups.set(record.employeeId, group);
  }

  const events: AllocationReleaseEvent[] = [];

  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) =>
      compareMonthKeys(a.monthKey, b.monthKey),
    );

    for (let index = 1; index < sorted.length; index++) {
      const previous = sorted[index - 1];
      const current = sorted[index];

      if (
        previous.workforceState !== "ACTIVE" ||
        current.workforceState !== "ACTIVE" ||
        addMonths(previous.monthKey, 1) !== current.monthKey
      ) {
        continue;
      }

      const reduction = previous.allocatedHours - current.allocatedHours;

      if (reduction <= 0) {
        continue;
      }

      events.push({
        employeeId: current.employeeId,
        employeeName: current.employeeName,
        fromMonthKey: previous.monthKey,
        monthKey: current.monthKey,
        previousAllocatedHours: previous.allocatedHours,
        currentAllocatedHours: current.allocatedHours,
        allocationReductionHours: reduction,
        availableHours: current.availableHours,
      });
    }
  }

  return events.sort(
    (a, b) =>
      compareMonthKeys(a.monthKey, b.monthKey) ||
      b.allocationReductionHours - a.allocationReductionHours ||
      a.employeeId.localeCompare(b.employeeId),
  );
}
