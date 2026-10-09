import {
  capacityConfig,
  projectTrack,
  resourceMonthlyRecords,
  zinghr,
} from "../data";

import {
  FAMSTACK_MONTHS,
  PROJECT_TRACK_MONTHS,
  POC_CURRENT_MONTH,
} from "../constants/poc";

import type { ResourceMonthlyRecord } from "../types/resourceMonthly";

import { getMonthRange } from "../services/monthService";

import { getSourceForMonth } from "../services/sourcePeriodService";

export interface Phase6ValidationReport {
  isValid: boolean;

  errors: string[];

  warnings: string[];
}

function assert(condition: boolean, message: string, errors: string[]): void {
  if (!condition) {
    errors.push(message);
  }
}

function getCapacityKey(
  country: string,
  location: string,
  monthKey: string,
): string {
  return `${country}::${location}::${monthKey}`;
}

function getResourceRecordsForEmployee(
  employeeId: string,
): ResourceMonthlyRecord[] {
  return resourceMonthlyRecords
    .filter((record) => record.employee_id === employeeId)
    .sort((left, right) => left.month_key.localeCompare(right.month_key));
}

function validateMonthRange(errors: string[]): void {
  const expected = [
    "2026-09",
    "2026-10",
    "2026-11",
    "2026-12",
    "2027-01",
    "2027-02",
    "2027-03",
  ];

  const actual = getMonthRange("2026-09", 7);

  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    "Extended planning range must be Sep 2026 through Mar 2027.",
    errors,
  );
}

function validatePlanningConstants(errors: string[]): void {
  assert(
    POC_CURRENT_MONTH === "2026-09",
    `POC_CURRENT_MONTH must remain 2026-09; received ${POC_CURRENT_MONTH}.`,
    errors,
  );

  assert(
    FAMSTACK_MONTHS[FAMSTACK_MONTHS.length - 1] === "2026-08",
    "Famstack historical period must end at 2026-08.",
    errors,
  );

  assert(
    PROJECT_TRACK_MONTHS[0] === "2026-09",
    "Project Track planning must begin at 2026-09.",
    errors,
  );

  assert(
    PROJECT_TRACK_MONTHS[PROJECT_TRACK_MONTHS.length - 1] === "2027-03",
    "Project Track planning must end at 2027-03.",
    errors,
  );

  const required2027Months = ["2027-01", "2027-02", "2027-03"];

  const planningSet = new Set<string>(PROJECT_TRACK_MONTHS);

  for (const monthKey of required2027Months) {
    assert(
      planningSet.has(monthKey),
      `PROJECT_TRACK_MONTHS is missing ${monthKey}.`,
      errors,
    );
  }
}

function validateSourceBoundary(errors: string[]): void {
  assert(
    getSourceForMonth("2026-08") === "FAMSTACK",
    "August 2026 must resolve to FAMSTACK.",
    errors,
  );

  assert(
    getSourceForMonth("2026-09") === "PROJECT_TRACK",
    "September 2026 must resolve to PROJECT_TRACK.",
    errors,
  );

  assert(
    getSourceForMonth("2026-12") === "PROJECT_TRACK",
    "December 2026 must resolve to PROJECT_TRACK.",
    errors,
  );

  assert(
    getSourceForMonth("2027-01") === "PROJECT_TRACK",
    "January 2027 must resolve to PROJECT_TRACK.",
    errors,
  );

  assert(
    getSourceForMonth("2027-02") === "PROJECT_TRACK",
    "February 2027 must resolve to PROJECT_TRACK.",
    errors,
  );

  assert(
    getSourceForMonth("2027-03") === "PROJECT_TRACK",
    "March 2027 must resolve to PROJECT_TRACK.",
    errors,
  );
}

function validateCapacityCoverage(errors: string[]): void {
  const lookup = new Set(
    capacityConfig.map((record) =>
      getCapacityKey(record.country, record.location, record.month_key),
    ),
  );

  const required2027Months = ["2027-01", "2027-02", "2027-03"];

  for (const employee of zinghr) {
    for (const monthKey of required2027Months) {
      const key = getCapacityKey(employee.country, employee.location, monthKey);

      assert(
        lookup.has(key),
        `Missing 2027 capacity configuration for ${employee.employee_id}: ${employee.country}, ${employee.location}, ${monthKey}.`,
        errors,
      );
    }
  }
}

function validateProjectTrackCoverage(
  errors: string[],
  warnings: string[],
): void {
  const monthSet = new Set(projectTrack.map((record) => record.month_key));

  const requiredMonths = ["2027-01", "2027-02", "2027-03"];

  for (const monthKey of requiredMonths) {
    const count = projectTrack.filter(
      (record) => record.month_key === monthKey,
    ).length;

    assert(count > 0, `Project Track has no records for ${monthKey}.`, errors);
  }

  const tagged2027Count = projectTrack.filter(
    (record) =>
      monthSet.has(record.month_key) &&
      requiredMonths.includes(record.month_key) &&
      record.employee_tagging === "TAGGED",
  ).length;

  if (tagged2027Count === 0) {
    warnings.push(
      "No tagged employee Project Track allocations were found in Jan-Mar 2027.",
    );
  }
}

function validateNormalized2027Records(errors: string[]): void {
  const requiredMonths = ["2027-01", "2027-02", "2027-03"];

  for (const monthKey of requiredMonths) {
    const records = resourceMonthlyRecords.filter(
      (record) => record.month_key === monthKey,
    );

    assert(
      records.length > 0,
      `No normalized ResourceMonthlyRecord records exist for ${monthKey}.`,
      errors,
    );

    for (const record of records) {
      assert(
        record.source === "PROJECT_TRACK",
        `Normalized record ${record.employee_id}/${monthKey} must use PROJECT_TRACK.`,
        errors,
      );

      assert(
        Number.isFinite(record.total_capacity),
        `Invalid total_capacity for ${record.employee_id}/${monthKey}.`,
        errors,
      );

      assert(
        Number.isFinite(record.utilized_capacity),
        `Invalid utilized_capacity for ${record.employee_id}/${monthKey}.`,
        errors,
      );

      assert(
        Number.isFinite(record.available_capacity),
        `Invalid available_capacity for ${record.employee_id}/${monthKey}.`,
        errors,
      );

      assert(
        Number.isFinite(record.availability_percentage),
        `Invalid availability_percentage for ${record.employee_id}/${monthKey}.`,
        errors,
      );

      assert(
        Math.abs(
          record.total_capacity -
            record.utilized_capacity -
            record.available_capacity,
        ) < 0.001,
        `Availability arithmetic mismatch for ${record.employee_id}/${monthKey}.`,
        errors,
      );
    }
  }
}

function validateNoDuplicateEmployeeMonthRecords(errors: string[]): void {
  const keys = new Set<string>();

  for (const record of resourceMonthlyRecords) {
    const key = `${record.employee_id}::${record.month_key}`;

    assert(
      !keys.has(key),
      `Duplicate normalized employee-month record: ${key}.`,
      errors,
    );

    keys.add(key);
  }
}

function validateEmployeeCoverage(errors: string[]): void {
  for (const employee of zinghr) {
    const records = getResourceRecordsForEmployee(employee.employee_id);

    /*
     * Only employees who are active across
     * a given month should have a record.
     *
     * We do not assert a fixed number here
     * because joining/leaving dates can
     * legitimately shorten the range.
     */
    assert(
      records.length > 0,
      `Employee ${employee.employee_id} has no normalized availability records.`,
      errors,
    );
  }
}

function validateYearBoundaryContinuity(errors: string[]): void {
  for (const employee of zinghr) {
    const records = getResourceRecordsForEmployee(employee.employee_id);

    const december = records.find((record) => record.month_key === "2026-12");

    const january = records.find((record) => record.month_key === "2027-01");

    /*
     * An employee may legitimately disappear
     * because they left before January.
     *
     * Therefore only validate the January
     * record if the employee remains active
     * according to the generated dataset.
     */
    if (december === undefined || january === undefined) {
      continue;
    }

    assert(
      january.source === "PROJECT_TRACK",
      `January 2027 source mismatch for ${employee.employee_id}.`,
      errors,
    );

    assert(
      january.month_key === "2027-01",
      `January 2027 month key mismatch for ${employee.employee_id}.`,
      errors,
    );
  }
}

function validateFutureAvailabilityScenarios(errors: string[]): void {
  const january = resourceMonthlyRecords.filter(
    (record) => record.month_key === "2027-01",
  );

  const february = resourceMonthlyRecords.filter(
    (record) => record.month_key === "2027-02",
  );

  const march = resourceMonthlyRecords.filter(
    (record) => record.month_key === "2027-03",
  );

  /*
   * The phase requires actual data, not
   * placeholder months. These assertions
   * ensure the normalized dataset contains
   * usable positive/non-zero capacity.
   */
  assert(
    january.some((record) => record.total_capacity > 0),
    "January 2027 must contain resources with positive capacity.",
    errors,
  );

  assert(
    february.some((record) => record.total_capacity > 0),
    "February 2027 must contain resources with positive capacity.",
    errors,
  );

  assert(
    march.some((record) => record.total_capacity > 0),
    "March 2027 must contain resources with positive capacity.",
    errors,
  );
}

export function validatePhase6(): Phase6ValidationReport {
  const errors: string[] = [];

  const warnings: string[] = [];

  validatePlanningConstants(errors);

  validateMonthRange(errors);

  validateSourceBoundary(errors);

  validateCapacityCoverage(errors);

  validateProjectTrackCoverage(errors, warnings);

  validateNormalized2027Records(errors);

  validateNoDuplicateEmployeeMonthRecords(errors);

  validateEmployeeCoverage(errors);

  validateYearBoundaryContinuity(errors);

  validateFutureAvailabilityScenarios(errors);

  return {
    isValid: errors.length === 0,

    errors,

    warnings,
  };
}

export function logPhase6Validation(): void {
  const report = validatePhase6();

  if (report.isValid) {
    console.info("[Resource Vision] Phase 6 / 2027 horizon validation passed.");
  } else {
    console.error(
      "[Resource Vision] Phase 6 / 2027 horizon validation failed.",
    );

    for (const error of report.errors) {
      console.error(`[Resource Vision] ${error}`);
    }
  }

  for (const warning of report.warnings) {
    console.warn(`[Resource Vision] ${warning}`);
  }
}
