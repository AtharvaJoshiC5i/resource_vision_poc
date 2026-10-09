import { capacityConfig, famstack, projectTrack, zinghr } from "../data";

import { FAMSTACK_MONTHS, PROJECT_TRACK_MONTHS } from "../constants/poc";

export interface ValidationReport {
  isValid: boolean;

  errors: string[];

  warnings: string[];
}

const REQUIRED_ZINGHR_STRING_FIELDS = [
  "employee_id",
  "employee_name",
  "email",
  "primary_capability",
  "secondary_capability",
  "department",
  "grade",
  "location",
  "country",
  "employment_status",
  "date_of_joining",
] as const;

function getCapacityKey(
  country: string,
  location: string,
  monthKey: string,
): string {
  return `${country}::${location}::${monthKey}`;
}

function isValidMonthKey(monthKey: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey);
}

function getRequiredMonths(): string[] {
  return [...FAMSTACK_MONTHS, ...PROJECT_TRACK_MONTHS];
}

function getRequiredProjectTrackMonths(): string[] {
  return [...PROJECT_TRACK_MONTHS];
}

function validateMonthConstants(errors: string[]): void {
  const allMonths = getRequiredMonths();

  const uniqueMonths = new Set(allMonths);

  if (uniqueMonths.size !== allMonths.length) {
    errors.push(
      "Duplicate month keys were found in FAMSTACK_MONTHS / PROJECT_TRACK_MONTHS.",
    );
  }

  for (const monthKey of allMonths) {
    if (!isValidMonthKey(monthKey)) {
      errors.push(`Invalid month key in planning constants: ${monthKey}.`);
    }
  }

  const required2027Months = ["2027-01", "2027-02", "2027-03"];

  const projectTrackMonthSet = new Set(PROJECT_TRACK_MONTHS);

  for (const monthKey of required2027Months) {
    if (
      !projectTrackMonthSet.has(
        monthKey as (typeof PROJECT_TRACK_MONTHS)[number],
      )
    ) {
      errors.push(
        `Project Track planning horizon is missing required 2027 month: ${monthKey}.`,
      );
    }
  }

  if (PROJECT_TRACK_MONTHS[0] !== "2026-09") {
    errors.push(
      `Project Track planning horizon should begin at 2026-09, but begins at ${PROJECT_TRACK_MONTHS[0] ?? "(empty)"}.`,
    );
  }

  const lastProjectTrackMonth =
    PROJECT_TRACK_MONTHS[PROJECT_TRACK_MONTHS.length - 1];

  if (lastProjectTrackMonth !== "2027-03") {
    errors.push(
      `Project Track planning horizon should currently end at 2027-03, but ends at ${lastProjectTrackMonth ?? "(empty)"}.`,
    );
  }
}

function validateZingHR(errors: string[]): Set<string> {
  const employeeIds = new Set<string>();

  for (const employee of zinghr) {
    if (employeeIds.has(employee.employee_id)) {
      errors.push(
        `Duplicate ZingHR employee_id found: ${employee.employee_id}.`,
      );
    }

    employeeIds.add(employee.employee_id);

    for (const field of REQUIRED_ZINGHR_STRING_FIELDS) {
      if (employee[field].trim() === "") {
        errors.push(
          `ZingHR employee ${employee.employee_id || "(blank employee_id)"} is missing required field: ${field}.`,
        );
      }
    }

    if (employee.weekly_capacity_hours <= 0) {
      errors.push(
        `ZingHR employee ${employee.employee_id} has invalid weekly_capacity_hours: ${employee.weekly_capacity_hours}.`,
      );
    }
  }

  return employeeIds;
}

function validateFamstack(errors: string[], employeeIds: Set<string>): void {
  const expectedFamstackMonths = new Set<string>(FAMSTACK_MONTHS);

  for (const record of famstack) {
    if (!employeeIds.has(record.employee_id)) {
      errors.push(
        `Famstack record references unknown employee_id ${record.employee_id} for month ${record.month_key}.`,
      );
    }

    if (!expectedFamstackMonths.has(record.month_key)) {
      errors.push(
        `Famstack record for employee ${record.employee_id} has unexpected month ${record.month_key}.`,
      );
    }
  }
}

function validateProjectTrack(
  errors: string[],
  employeeIds: Set<string>,
): void {
  const expectedProjectTrackMonths = new Set<string>(
    getRequiredProjectTrackMonths(),
  );

  const required2027Months = ["2027-01", "2027-02", "2027-03"];

  const projectTrack2027Months = new Set<string>();

  for (const record of projectTrack) {
    if (!expectedProjectTrackMonths.has(record.month_key)) {
      errors.push(
        `Project Track record ${record.project_id} has unexpected month ${record.month_key}.`,
      );
    }

    if (required2027Months.includes(record.month_key)) {
      projectTrack2027Months.add(record.month_key);
    }

    if (record.employee_tagging === "UNASSIGNED_GRADE_DEMAND") {
      if (record.employee_id !== "") {
        errors.push(
          `Unassigned demand record ${record.project_id} for ${record.month_key} unexpectedly contains employee_id ${record.employee_id}.`,
        );
      }

      if (record.employee_name !== "") {
        errors.push(
          `Unassigned demand record ${record.project_id} for ${record.month_key} unexpectedly contains employee_name ${record.employee_name}.`,
        );
      }

      continue;
    }

    if (record.employee_id.trim() === "") {
      errors.push(
        `Project Track record ${record.project_id} for ${record.month_key} is tagged as ${record.employee_tagging} but has no employee_id.`,
      );

      continue;
    }

    if (!employeeIds.has(record.employee_id)) {
      errors.push(
        `Project Track record ${record.project_id} references unknown employee_id ${record.employee_id}.`,
      );
    }
  }

  for (const monthKey of required2027Months) {
    if (!projectTrack2027Months.has(monthKey)) {
      errors.push(
        `Project Track contains no records for required 2027 planning month ${monthKey}.`,
      );
    }
  }
}

function validateCapacityConfiguration(errors: string[]): Set<string> {
  const capacityKeys = new Set<string>();

  for (const record of capacityConfig) {
    const key = getCapacityKey(
      record.country,
      record.location,
      record.month_key,
    );

    if (capacityKeys.has(key)) {
      errors.push(
        `Duplicate capacity configuration found for ${record.country}, ${record.location}, ${record.month_key}.`,
      );
    }

    capacityKeys.add(key);

    if (!isValidMonthKey(record.month_key)) {
      errors.push(
        `Capacity configuration contains invalid month_key ${record.month_key} for ${record.country}, ${record.location}.`,
      );
    }

    if (record.working_days < 0) {
      errors.push(
        `Capacity configuration has negative working_days for ${record.country}, ${record.location}, ${record.month_key}.`,
      );
    }

    if (record.hours_per_day < 0) {
      errors.push(
        `Capacity configuration has negative hours_per_day for ${record.country}, ${record.location}, ${record.month_key}.`,
      );
    }

    const calculatedCapacity = record.working_days * record.hours_per_day;

    if (calculatedCapacity !== record.standard_capacity_hours) {
      errors.push(
        `Capacity configuration mismatch for ${record.country}, ${record.location}, ${record.month_key}: working_days × hours_per_day = ${calculatedCapacity}, but standard_capacity_hours = ${record.standard_capacity_hours}.`,
      );
    }
  }

  return capacityKeys;
}

function validateEmployeeMonthCoverage(
  errors: string[],
  employeeIds: Set<string>,
  capacityKeys: Set<string>,
): void {
  const allRequiredMonths = getRequiredMonths();

  for (const employee of zinghr) {
    for (const monthKey of allRequiredMonths) {
      const capacityKey = getCapacityKey(
        employee.country,
        employee.location,
        monthKey,
      );

      if (!capacityKeys.has(capacityKey)) {
        errors.push(
          `Missing capacity configuration for employee ${employee.employee_id}: ${employee.country}, ${employee.location}, ${monthKey}.`,
        );
      }
    }
  }

  /*
   * Explicitly verify the year-boundary months
   * required by the Phase 8 extension.
   *
   * This catches a partial data extension where
   * 2027-01 exists but 2027-02 or 2027-03 does not.
   */
  const required2027Months = ["2027-01", "2027-02", "2027-03"];

  for (const employeeId of employeeIds) {
    const employee = zinghr.find(
      (candidate) => candidate.employee_id === employeeId,
    );

    if (employee === undefined) {
      continue;
    }

    for (const monthKey of required2027Months) {
      const key = getCapacityKey(employee.country, employee.location, monthKey);

      if (!capacityKeys.has(key)) {
        errors.push(
          `Missing 2027 capacity configuration for employee ${employee.employee_id}: ${employee.country}, ${employee.location}, ${monthKey}.`,
        );
      }
    }
  }
}

function validatePlanningBoundary(errors: string[]): void {
  /*
   * The business source boundary is fixed:
   *
   * Jan-Aug 2026 -> Famstack
   * Sep 2026+    -> Project Track
   *
   * The Phase 8 extension must therefore preserve
   * Project Track through March 2027.
   */
  const lastHistoricalMonth = FAMSTACK_MONTHS[FAMSTACK_MONTHS.length - 1];

  const firstPlanningMonth = PROJECT_TRACK_MONTHS[0];

  const lastPlanningMonth =
    PROJECT_TRACK_MONTHS[PROJECT_TRACK_MONTHS.length - 1];

  if (lastHistoricalMonth !== "2026-08") {
    errors.push(
      `Historical Famstack period should currently end at 2026-08, but ends at ${lastHistoricalMonth ?? "(empty)"}.`,
    );
  }

  if (firstPlanningMonth !== "2026-09") {
    errors.push(
      `Planning should begin at 2026-09, but begins at ${firstPlanningMonth ?? "(empty)"}.`,
    );
  }

  if (lastPlanningMonth !== "2027-03") {
    errors.push(
      `Extended planning horizon should currently end at 2027-03, but ends at ${lastPlanningMonth ?? "(empty)"}.`,
    );
  }
}

function validateProjectTrackYearBoundary(errors: string[]): void {
  const projectTrackMonths = new Set(
    projectTrack.map((record) => record.month_key),
  );

  const boundaryMonths = ["2026-12", "2027-01", "2027-02", "2027-03"];

  for (const monthKey of boundaryMonths) {
    if (!projectTrackMonths.has(monthKey)) {
      errors.push(
        `Project Track year-boundary coverage is missing month ${monthKey}.`,
      );
    }
  }
}

function validateCapacityYearBoundary(errors: string[]): void {
  const capacityMonths = new Set(
    capacityConfig.map((record) => record.month_key),
  );

  const boundaryMonths = ["2026-12", "2027-01", "2027-02", "2027-03"];

  for (const monthKey of boundaryMonths) {
    if (!capacityMonths.has(monthKey)) {
      errors.push(
        `Capacity configuration year-boundary coverage is missing month ${monthKey}.`,
      );
    }
  }
}

export function validateData(): ValidationReport {
  const errors: string[] = [];

  const warnings: string[] = [];

  /*
   * 1. Validate centralized month
   *    constants first.
   */
  validateMonthConstants(errors);

  /*
   * 2. Validate employee master data.
   */
  const employeeIds = validateZingHR(errors);

  /*
   * 3. Validate historical actuals.
   */
  validateFamstack(errors, employeeIds);

  /*
   * 4. Validate current/future
   *    Project Track data.
   */
  validateProjectTrack(errors, employeeIds);

  /*
   * 5. Validate calendar capacity
   *    configuration.
   */
  const capacityKeys = validateCapacityConfiguration(errors);

  /*
   * 6. Every employee must have
   *    a capacity entry for every
   *    required month.
   */
  validateEmployeeMonthCoverage(errors, employeeIds, capacityKeys);

  /*
   * 7. Explicitly validate the
   *    source-period boundary.
   */
  validatePlanningBoundary(errors);

  /*
   * 8. Explicitly validate the
   *    Dec 2026 -> Mar 2027
   *    year-boundary coverage.
   */
  validateProjectTrackYearBoundary(errors);

  validateCapacityYearBoundary(errors);

  /*
   * Unassigned demand is valid POC data.
   * It must exist separately from employee
   * utilization, but its absence is only a
   * warning rather than a validation error.
   */
  const unassignedDemandCount = projectTrack.filter(
    (record) => record.employee_tagging === "UNASSIGNED_GRADE_DEMAND",
  ).length;

  if (unassignedDemandCount === 0) {
    warnings.push(
      "No UNASSIGNED_GRADE_DEMAND records were found in Project Track.",
    );
  }

  /*
   * Warn if the extended 2027
   * planning horizon contains no
   * planned effort at all. This does
   * not invalidate the source data
   * because a month can legitimately
   * contain zero planned allocations.
   */
  const planning2027Records = projectTrack.filter(
    (record) =>
      record.month_key === "2027-01" ||
      record.month_key === "2027-02" ||
      record.month_key === "2027-03",
  );

  if (planning2027Records.length === 0) {
    warnings.push(
      "The Project Track dataset contains no January-March 2027 planning records.",
    );
  }

  return {
    isValid: errors.length === 0,

    errors,

    warnings,
  };
}

export function logDataValidation(): void {
  const report = validateData();

  if (report.isValid) {
    console.info("[Resource Vision] Synthetic source data validation passed.");
  } else {
    console.error("[Resource Vision] Synthetic source data validation failed.");

    for (const error of report.errors) {
      console.error(`[Resource Vision] ${error}`);
    }
  }

  for (const warning of report.warnings) {
    console.warn(`[Resource Vision] ${warning}`);
  }
}
