import type { EmployeeMonthAvailability } from "../types/domain";

import {
  getFirstUsableCapacityMonth,
  isAvailableByRequirementStart,
} from "../services/availabilityTimingService";

export interface ProjectStartCompatibilityReport {
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

export function validateProjectStartCompatibility(): ProjectStartCompatibilityReport {
  const errors: string[] = [];
  let passed = 0;

  function check(name: string, condition: boolean): void {
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

  const partial = isAvailableByRequirementStart(
    records,
    "EMP001",
    "2026-12-01",
  );

  check(
    "Partial capacity is identified",
    partial?.status === "PARTIALLY_AVAILABLE_BY_START" &&
      partial.availableHours === 56,
  );

  const fortyHours = isAvailableByRequirementStart(
    records,
    "EMP001",
    "2026-12-01",
    40,
  );

  check(
    "40-hour requirement fits available capacity",
    fortyHours?.meetsRequiredHours === true,
  );

  const hundredHours = isAvailableByRequirementStart(
    records,
    "EMP001",
    "2026-12-01",
    100,
  );

  check(
    "100-hour requirement exceeds available capacity",
    hundredHours?.meetsRequiredHours === false,
  );

  const fullyAvailable = isAvailableByRequirementStart(
    records,
    "EMP001",
    "2027-01-01",
  );

  check(
    "Full availability is identified",
    fullyAvailable?.status === "AVAILABLE_BY_START" &&
      fullyAvailable.availableHours === 168,
  );

  const unavailable = isAvailableByRequirementStart(
    records,
    "EMP001",
    "2026-11-01",
  );

  check(
    "Fully allocated month is unavailable",
    unavailable?.status === "NOT_AVAILABLE_BY_START",
  );

  const firstUsable = getFirstUsableCapacityMonth(records, "EMP001", "2026-11");

  check("First usable month is December", firstUsable === "2026-12");

  const firstHundred = getFirstUsableCapacityMonth(
    records,
    "EMP001",
    "2026-11",
    100,
  );

  check("First month with 100 hours is January", firstHundred === "2027-01");

  const missingMonth = isAvailableByRequirementStart(
    records,
    "EMP001",
    "2027-02-01",
  );

  check("Missing planning month is unknown", missingMonth === null);

  check(
    "Timing assessment is month-level",
    partial?.timingPrecision === "MONTH",
  );

  const otherEmployee = isAvailableByRequirementStart(
    records,
    "EMP999",
    "2026-12-01",
  );

  check("Unknown employee has no timing assessment", otherEmployee === null);

  return {
    isValid: errors.length === 0,
    passed,
    failed: errors.length,
    errors,
  };
}

export function logProjectStartCompatibilityValidation(): void {
  const report = validateProjectStartCompatibility();

  if (report.isValid) {
    console.info(
      `[Resource Vision] Project start compatibility: ${report.passed} checks passed.`,
    );
  } else {
    console.error(
      `[Resource Vision] Project start compatibility: ${report.failed} checks failed.`,
    );

    for (const error of report.errors) {
      console.error(`[Resource Vision] ${error}`);
    }
  }
}
