import type { EmployeeMonthAvailability } from "../types/domain";

import {
  isAvailableByRequirementStart,
  getFirstUsableCapacityMonth,
} from "../services/availabilityTimingService";

export interface AvailabilityTimingValidationReport {
  isValid: boolean;
  passed: number;
  failed: number;
  errors: string[];
}

function makeRecord(
  employeeId: string,
  monthKey: string,
  capacity: number,
  allocated: number,
): EmployeeMonthAvailability {
  const available = capacity - allocated;

  const status: EmployeeMonthAvailability["status"] =
    available < 0
      ? "OVER_ALLOCATED"
      : available === 0
        ? "FULLY_ALLOCATED"
        : allocated === 0
          ? "AVAILABLE"
          : "PARTIALLY_AVAILABLE";

  return {
    employeeId,
    employeeName: employeeId,
    monthKey,
    workforceState: "ACTIVE",

    totalCapacityHours: capacity,
    allocatedHours: allocated,
    blockedHours: 0,

    availableHours: available,
    availableToPromiseHours: available,

    availabilityPercentage: capacity === 0 ? 0 : (available / capacity) * 100,

    utilizationPercentage: capacity === 0 ? 0 : (allocated / capacity) * 100,

    status,
    source: "PROJECT_TRACK",
    projectAllocations: [],

    primaryCapability: "Applied AI",
    secondaryCapability: "GenAI",
    department: "Technology",
    grade: "D1",
    location: "Bengaluru",
    country: "India",
  };
}

export function validateAvailabilityTiming(): AvailabilityTimingValidationReport {
  const errors: string[] = [];
  let passed = 0;

  function check(name: string, condition: boolean) {
    if (condition) {
      passed += 1;
    } else {
      errors.push(name);
    }
  }

  const records = [
    makeRecord("EMP001", "2026-11", 160, 160),
    makeRecord("EMP001", "2026-12", 176, 120),
    makeRecord("EMP001", "2027-01", 168, 0),
  ];

  const december = isAvailableByRequirementStart(
    records,
    "EMP001",
    "2026-12-01",
  );

  check(
    "December partial availability",
    december?.status === "PARTIALLY_AVAILABLE_BY_START" &&
      december.availableHours === 56,
  );

  const fortyHours = isAvailableByRequirementStart(
    records,
    "EMP001",
    "2026-12-01",
    40,
  );

  check(
    "40-hour requirement can fit December capacity",
    fortyHours?.meetsRequiredHours === true,
  );

  const oneHundredHours = isAvailableByRequirementStart(
    records,
    "EMP001",
    "2026-12-01",
    100,
  );

  check(
    "100-hour requirement exceeds December capacity",
    oneHundredHours?.meetsRequiredHours === false,
  );

  const january = isAvailableByRequirementStart(
    records,
    "EMP001",
    "2027-01-01",
  );

  check(
    "January full availability",
    january?.status === "AVAILABLE_BY_START" &&
      january.isFullyAvailable &&
      january.availableHours === 168,
  );

  const november = isAvailableByRequirementStart(
    records,
    "EMP001",
    "2026-11-01",
  );

  check(
    "November has no usable capacity",
    november?.status === "NOT_AVAILABLE_BY_START",
  );

  const firstUsable = getFirstUsableCapacityMonth(records, "EMP001", "2026-11");

  check("First usable capacity is December", firstUsable === "2026-12");

  const firstHundredHours = getFirstUsableCapacityMonth(
    records,
    "EMP001",
    "2026-11",
    100,
  );

  check(
    "First month with at least 100 hours is January",
    firstHundredHours === "2027-01",
  );

  const missing = isAvailableByRequirementStart(
    records,
    "EMP001",
    "2027-02-01",
  );

  check(
    "Missing month returns unknown rather than unavailable",
    missing === null,
  );

  check(
    "Timing precision remains monthly",
    december?.timingPrecision === "MONTH",
  );

  check(
    "Year-boundary capacity is preserved",
    january?.requirementMonth === "2027-01",
  );

  return {
    isValid: errors.length === 0,
    passed,
    failed: errors.length,
    errors,
  };
}

export function logAvailabilityTimingValidation(): void {
  const report = validateAvailabilityTiming();

  if (report.isValid) {
    console.info(
      `[Resource Vision] Availability timing: ${report.passed} checks passed.`,
    );
  } else {
    console.error(
      `[Resource Vision] Availability timing: ${report.failed} checks failed.`,
    );

    for (const error of report.errors) {
      console.error(`[Resource Vision] ${error}`);
    }
  }
}
