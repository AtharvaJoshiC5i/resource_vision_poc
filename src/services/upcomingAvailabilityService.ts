import type {
  AvailabilityTransition,
  AvailabilityTransitionType,
  EmployeeMonthAvailability,
} from "../types/domain";

import { compareMonthKeys } from "./monthService";

function getTransitionTypes(
  previous: EmployeeMonthAvailability,
  current: EmployeeMonthAvailability,
): AvailabilityTransitionType[] {
  const types: AvailabilityTransitionType[] = [];

  /*
   * Positive month-to-month change means that
   * additional capacity has become available.
   *
   * This applies equally across year boundaries:
   *
   * Dec 2026 -> Jan 2027
   * Jan 2027 -> Feb 2027
   * Feb 2027 -> Mar 2027
   */
  if (current.availableHours > previous.availableHours) {
    types.push("GAINED_CAPACITY");
  }

  /*
   * Separate event:
   * the employee moves from any non-available
   * state into full availability.
   */
  if (previous.status !== "AVAILABLE" && current.status === "AVAILABLE") {
    types.push("BECAME_FULLY_AVAILABLE");
  }

  /*
   * Fully allocated -> partially available.
   */
  if (
    previous.status === "FULLY_ALLOCATED" &&
    current.status === "PARTIALLY_AVAILABLE"
  ) {
    types.push("FULLY_ALLOCATED_TO_PARTIAL");
  }

  /*
   * Partially available -> fully available.
   *
   * This is intentionally retained as a
   * separate transition type because existing
   * UI/logic may use it for explanatory context.
   */
  if (
    previous.status === "PARTIALLY_AVAILABLE" &&
    current.status === "AVAILABLE"
  ) {
    types.push("PARTIAL_TO_FULLY_AVAILABLE");
  }

  return types;
}

export function getUpcomingAvailabilityTransitions(
  records: EmployeeMonthAvailability[],
): AvailabilityTransition[] {
  /*
   * Group by canonical employee identity first.
   *
   * This guarantees that each employee's
   * month-to-month comparison happens only
   * against their own availability history.
   */
  const recordsByEmployee = new Map<string, EmployeeMonthAvailability[]>();

  for (const record of records) {
    const existing = recordsByEmployee.get(record.employeeId) ?? [];

    existing.push(record);

    recordsByEmployee.set(record.employeeId, existing);
  }

  const transitions: AvailabilityTransition[] = [];

  for (const employeeRecords of recordsByEmployee.values()) {
    /*
     * Month keys are sorted using the shared
     * month utility, so:
     *
     * 2026-12
     * 2027-01
     * 2027-02
     * 2027-03
     *
     * are correctly ordered.
     */
    const sorted = [...employeeRecords].sort((left, right) =>
      compareMonthKeys(left.monthKey, right.monthKey),
    );

    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];

      const current = sorted[index];

      const transitionTypes = getTransitionTypes(previous, current);

      /*
       * No meaningful transition:
       * don't create a row.
       */
      if (transitionTypes.length === 0) {
        continue;
      }

      transitions.push({
        employeeId: current.employeeId,

        employeeName: current.employeeName,

        fromMonthKey: previous.monthKey,

        toMonthKey: current.monthKey,

        fromStatus: previous.status,

        toStatus: current.status,

        previousAvailableHours: previous.availableHours,

        currentAvailableHours: current.availableHours,

        additionalAvailableHours:
          current.availableHours - previous.availableHours,

        transitionTypes,
      });
    }
  }

  /*
   * Sort by the month in which the transition
   * occurs, then by biggest capacity gain.
   *
   * This means an Overview beginning in
   * Sep 2026 can naturally surface:
   *
   * Dec 2026 -> Jan 2027
   * Jan 2027 -> Feb 2027
   * Feb 2027 -> Mar 2027
   */
  return transitions.sort((left, right) => {
    const monthComparison = compareMonthKeys(left.toMonthKey, right.toMonthKey);

    if (monthComparison !== 0) {
      return monthComparison;
    }

    return right.additionalAvailableHours - left.additionalAvailableHours;
  });
}
