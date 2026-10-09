import { availabilityQueryContext } from "../data";

import { POC_CURRENT_MONTH, PROJECT_TRACK_MONTHS } from "../constants/poc";

import { getAvailabilityForRange } from "../services/availabilityQueryService";

import {
  getCapacityGains,
  getExpectedRelease,
  getResourceReleaseForecast,
} from "../services/resourceReleaseService";

import { getMonthRange, compareMonthKeys } from "../services/monthService";

import type { EmployeeMonthAvailability } from "../types/domain";

export interface ReleaseIntegrationReport {
  isValid: boolean;
  passed: number;
  failed: number;
  errors: string[];
  warnings: string[];
}

const TOLERANCE = 0.001;

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= TOLERANCE;
}

export function validateReleaseIntegration(): ReleaseIntegrationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  let passed = 0;

  function check(description: string, condition: boolean): void {
    if (condition) {
      passed += 1;
    } else {
      errors.push(description);
    }
  }

  const monthKeys = getMonthRange(
    POC_CURRENT_MONTH,
    PROJECT_TRACK_MONTHS.length,
  );

  const records = getAvailabilityForRange(
    availabilityQueryContext,
    POC_CURRENT_MONTH,
    PROJECT_TRACK_MONTHS.length,
  );

  const monthSet = new Set(records.map((record) => record.monthKey));

  // 1. Planning horizon is correct.
  check(
    "Planning horizon matches Project Track constants",
    monthKeys.length === PROJECT_TRACK_MONTHS.length &&
      monthKeys.every((month, index) => month === PROJECT_TRACK_MONTHS[index]),
  );

  // 2. Availability records exist.
  check("Canonical availability records exist", records.length > 0);

  // 3. All planning months have availability records.
  check(
    "All planning months have availability coverage",
    monthKeys.every((month) => monthSet.has(month)),
  );

  // 4. No duplicate employee-month records.
  const uniqueKeys = new Set<string>();

  let hasDuplicates = false;

  for (const record of records) {
    const key = `${record.employeeId}::${record.monthKey}`;

    if (uniqueKeys.has(key)) {
      hasDuplicates = true;
    }

    uniqueKeys.add(key);
  }

  check("No duplicate employee-month availability records", !hasDuplicates);

  // 5. Availability arithmetic is consistent.
  check(
    "Capacity minus allocations equals available hours",
    records.every((record) =>
      nearlyEqual(
        record.totalCapacityHours - record.allocatedHours,
        record.availableHours,
      ),
    ),
  );

  // 6. All numeric values are finite.
  check(
    "Availability numeric fields are finite",
    records.every(
      (record) =>
        Number.isFinite(record.totalCapacityHours) &&
        Number.isFinite(record.allocatedHours) &&
        Number.isFinite(record.availableHours) &&
        Number.isFinite(record.availabilityPercentage),
    ),
  );

  // 7. Availability percentages reconcile.
  check(
    "Availability percentages reconcile",
    records.every((record) => {
      const expected =
        record.totalCapacityHours === 0
          ? 0
          : (record.availableHours / record.totalCapacityHours) * 100;

      return nearlyEqual(record.availabilityPercentage, expected);
    }),
  );

  // 8. Project breakdown matches allocated hours.
  check(
    "Project allocation breakdown reconciles",
    records.every((record) => {
      const breakdownHours = record.projectAllocations.reduce(
        (total, project) => total + project.allocatedHours,
        0,
      );

      return nearlyEqual(breakdownHours, record.allocatedHours);
    }),
  );

  // 9. All release events represent positive gains.
  const events = getCapacityGains(records);

  check(
    "Release events represent positive availability gains",
    events.every(
      (event) =>
        event.releasedHours > 0 &&
        nearlyEqual(
          event.availableHours - event.previousAvailableHours,
          event.releasedHours,
        ),
    ),
  );

  // 10. Allocation reductions are never negative.
  check(
    "Allocation reduction values are non-negative",
    events.every((event) => event.allocationReductionHours >= 0),
  );

  // 11. Forecast reconciles with employee events.
  const forecast = getResourceReleaseForecast(records);

  check(
    "Release forecast reconciles with employee events",
    forecast.every((month) => {
      const monthEvents = events.filter(
        (event) => event.monthKey === month.monthKey,
      );

      const expectedHours = monthEvents.reduce(
        (total, event) => total + event.releasedHours,
        0,
      );

      return (
        nearlyEqual(expectedHours, month.capacityReleasedHours) &&
        month.resourcesReleasing ===
          new Set(monthEvents.map((event) => event.employeeId)).size
      );
    }),
  );

  // 12. Employee release outlook is consistent.
  const employeeIds = [...new Set(records.map((record) => record.employeeId))];

  check(
    "Expected release outlook is available for employees",
    employeeIds.every((employeeId) => {
      const employeeRecords = records.filter(
        (record) => record.employeeId === employeeId,
      );

      const firstRecord = employeeRecords.sort((left, right) =>
        compareMonthKeys(left.monthKey, right.monthKey),
      )[0];

      if (!firstRecord) {
        return false;
      }

      const release = getExpectedRelease(
        records,
        employeeId,
        firstRecord.monthKey,
      );

      return release !== null && release.employeeId === employeeId;
    }),
  );

  // 13. Explicit year-boundary coverage.
  check(
    "December 2026 and January 2027 are covered",
    monthSet.has("2026-12") && monthSet.has("2027-01"),
  );

  // 14. No release event references an unknown employee.
  const employeeSet = new Set(employeeIds);

  check(
    "Release events reference known employees",
    events.every((event) => employeeSet.has(event.employeeId)),
  );

  // 15. Forecast months are in chronological order.
  check(
    "Forecast months are chronologically ordered",
    forecast.every(
      (month, index) =>
        index === 0 ||
        compareMonthKeys(forecast[index - 1].monthKey, month.monthKey) < 0,
    ),
  );

  // Diagnostic warnings, not failures.
  const fullReleaseEvents = events.filter(
    (event) => event.type === "FULL_RELEASE",
  );

  const partialReleaseEvents = events.filter(
    (event) => event.type === "PARTIAL_RELEASE",
  );

  if (fullReleaseEvents.length === 0) {
    warnings.push(
      "No full-release events were found in the current mock dataset.",
    );
  }

  if (partialReleaseEvents.length === 0) {
    warnings.push(
      "No partial-release events were found in the current mock dataset.",
    );
  }

  const allocationDrivenEvents = events.filter(
    (event) => event.allocationReductionHours > 0,
  );

  if (allocationDrivenEvents.length === 0) {
    warnings.push(
      "No capacity-gain events with reduced project allocations were found.",
    );
  }

  return {
    isValid: errors.length === 0,
    passed,
    failed: errors.length,
    errors,
    warnings,
  };
}

export function logReleaseIntegrationValidation(): void {
  const report = validateReleaseIntegration();

  if (report.isValid) {
    console.info(
      `[Resource Vision] Release integration: ${report.passed} checks passed.`,
    );
  } else {
    console.error(
      `[Resource Vision] Release integration: ${report.failed} checks failed.`,
    );
  }

  for (const error of report.errors) {
    console.error(`[Resource Vision] ${error}`);
  }

  for (const warning of report.warnings) {
    console.warn(`[Resource Vision] ${warning}`);
  }
}
