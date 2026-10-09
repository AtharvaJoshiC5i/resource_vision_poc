import type { EmployeeMonthAvailability } from "../types/domain";

import {
  getCapacityGains,
  getExpectedRelease,
  getResourceReleaseForecast,
} from "../services/resourceReleaseService";

export interface ResourceReleaseScenarioReport {
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
    primaryCapability: "Data Science",
    secondaryCapability: "Machine Learning",
    department: "Technology",
    grade: "D1",
    location: "Bengaluru",
    country: "India",
  };
}

export function validateResourceReleaseScenarios(): ResourceReleaseScenarioReport {
  const errors: string[] = [];
  let passed = 0;

  function check(name: string, condition: boolean): void {
    if (condition) {
      passed += 1;
    } else {
      errors.push(name);
    }
  }

  // Scenario 1: Fully allocated to partially available.
  const partial = getCapacityGains([
    makeRecord("EMP001", "2026-11", 160, 160),
    makeRecord("EMP001", "2026-12", 176, 120),
  ]);

  check(
    "Partial release is detected",
    partial.length === 1 &&
      partial[0].type === "PARTIAL_RELEASE" &&
      partial[0].releasedHours === 56,
  );

  // Scenario 2: Partially allocated to fully available.
  const full = getCapacityGains([
    makeRecord("EMP002", "2026-12", 176, 120),
    makeRecord("EMP002", "2027-01", 168, 0),
  ]);

  check(
    "Full release is detected",
    full.length === 1 &&
      full[0].type === "FULL_RELEASE" &&
      full[0].releasedHours === 112 &&
      full[0].allocationReductionHours === 120,
  );

  // Scenario 3: A capacity reduction is not a release.
  const reduction = getCapacityGains([
    makeRecord("EMP003", "2026-10", 176, 56),
    makeRecord("EMP003", "2026-11", 160, 120),
  ]);

  check("Capacity reduction is excluded", reduction.length === 0);

  // Scenario 4: Working-day increase without allocation reduction.
  const calendarGain = getCapacityGains([
    makeRecord("EMP004", "2026-11", 160, 80),
    makeRecord("EMP004", "2026-12", 176, 80),
  ]);

  check(
    "Calendar-driven gain is distinguished",
    calendarGain.length === 1 &&
      calendarGain[0].releasedHours === 16 &&
      calendarGain[0].allocationReductionHours === 0,
  );

  // Scenario 5: Multiple projects remain allocated.
  const multipleProjects = getCapacityGains([
    makeRecord("EMP005", "2026-11", 160, 160),
    makeRecord("EMP005", "2026-12", 176, 80),
  ]);

  check(
    "Remaining allocations prevent full release",
    multipleProjects.length === 1 &&
      multipleProjects[0].type === "PARTIAL_RELEASE" &&
      multipleProjects[0].availableHours === 96,
  );

  // Scenario 6: Already fully available.
  const alreadyAvailable = getExpectedRelease(
    [makeRecord("EMP006", "2026-12", 176, 0)],
    "EMP006",
    "2026-12",
  );

  check(
    "Already-available employee is recognized",
    alreadyAvailable?.currentAvailableHours === 176 &&
      alreadyAvailable.fullAvailabilityMonth === "2026-12",
  );

  // Scenario 7: No release when availability is unchanged.
  const unchanged = getCapacityGains([
    makeRecord("EMP007", "2026-11", 160, 80),
    makeRecord("EMP007", "2026-12", 176, 96),
  ]);

  check("Unchanged available hours produce no gain", unchanged.length === 0);

  // Scenario 8: Year-boundary continuity.
  const yearBoundary = getCapacityGains([
    makeRecord("EMP008", "2026-12", 176, 176),
    makeRecord("EMP008", "2027-01", 168, 0),
  ]);

  check(
    "December to January transition works",
    yearBoundary.length === 1 &&
      yearBoundary[0].monthKey === "2027-01" &&
      yearBoundary[0].releasedHours === 168,
  );

  // Scenario 9: Missing intermediate month.
  const missingMonth = getCapacityGains([
    makeRecord("EMP009", "2026-10", 176, 176),
    makeRecord("EMP009", "2026-12", 176, 0),
  ]);

  check(
    "Missing intervening month is not a confirmed release",
    missingMonth.length === 0,
  );

  // Scenario 10: Forecast respects supplied population.
  const filtered = [
    makeRecord("EMP010", "2026-11", 160, 160),
    makeRecord("EMP010", "2026-12", 176, 80),
  ];

  const forecast = getResourceReleaseForecast(filtered);
  const december = forecast.find((item) => item.monthKey === "2026-12");

  check(
    "Forecast uses only supplied employees",
    december?.resourcesReleasing === 1 && december.capacityReleasedHours === 96,
  );

  // Scenario 11: Next release and full availability differ.
  const progression = getExpectedRelease(
    [
      makeRecord("EMP011", "2026-11", 160, 160),
      makeRecord("EMP011", "2026-12", 176, 80),
      makeRecord("EMP011", "2027-01", 168, 0),
    ],
    "EMP011",
    "2026-11",
  );

  check(
    "Partial release and full availability are distinct",
    progression?.nextCapacityIncreaseMonth === "2026-12" &&
      progression.nextCapacityIncreaseHours === 96 &&
      progression.fullAvailabilityMonth === "2027-01",
  );

  // Scenario 12: Over-allocation remains visible.
  const overAllocated = getCapacityGains([
    makeRecord("EMP012", "2026-11", 160, 180),
    makeRecord("EMP012", "2026-12", 176, 160),
  ]);

  check(
    "Recovery from over-allocation is detected",
    overAllocated.length === 1 &&
      overAllocated[0].previousAvailableHours === -20 &&
      overAllocated[0].availableHours === 16 &&
      overAllocated[0].releasedHours === 36,
  );

  return {
    isValid: errors.length === 0,
    passed,
    failed: errors.length,
    errors,
  };
}

export function logResourceReleaseScenarioValidation(): void {
  const report = validateResourceReleaseScenarios();

  if (report.isValid) {
    console.info(
      `[Resource Vision] Resource release scenarios: ${report.passed} checks passed.`,
    );
  } else {
    console.error(
      `[Resource Vision] Resource release scenarios: ${report.failed} checks failed.`,
    );

    for (const error of report.errors) {
      console.error(`[Resource Vision] ${error}`);
    }
  }
}
