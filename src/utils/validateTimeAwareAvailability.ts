import type { EmployeeMonthAvailability, Project } from "../types/domain";

import {
  getCapacityGains,
  getExpectedRelease,
  getResourceReleaseForecast,
} from "../services/resourceReleaseService";

import { getProjectPlanningPriority } from "../services/projectPlanningPriorityService";

import { isAvailableByRequirementStart } from "../services/availabilityTimingService";

import { RESOURCE_PRIORITY_WINDOW_DAYS } from "../constants/resourcePlanning";

export interface TimeAwareValidationReport {
  isValid: boolean;
  passed: number;
  failed: number;
  errors: string[];
}

function createAvailability(
  employeeId: string,
  monthKey: string,
  capacity: number,
  allocated: number,
  primaryCapability = "Applied AI",
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

    primaryCapability,
    secondaryCapability: "GenAI",
    department: "Technology",
    grade: "D1",
    location: "Bengaluru",
    country: "India",
  };
}

function createProject(startDate: string): Project {
  return {
    projectId: "VALIDATION_PROJECT",
    proposalNumber: "VALIDATION",
    projectName: "Validation Project",
    projectStatus: "Planned",
    startDate,
    endDate: "2027-03-31",
  };
}

export function validateTimeAwareAvailability(): TimeAwareValidationReport {
  const errors: string[] = [];
  let passed = 0;

  function check(name: string, condition: boolean): void {
    if (condition) {
      passed += 1;
    } else {
      errors.push(name);
    }
  }

  const december = createAvailability("EMP_A", "2026-12", 176, 120);

  const january = createAvailability("EMP_A", "2027-01", 168, 0);

  const november = createAvailability("EMP_A", "2026-11", 160, 160);

  const records = [november, december, january];

  // 1. Fully available now.
  const fullyAvailable = createAvailability("EMP_FULL", "2026-10", 176, 0);

  check(
    "Fully available now",
    fullyAvailable.availableHours === 176 &&
      fullyAvailable.status === "AVAILABLE",
  );

  // 2. Partial capacity.
  const partial = createAvailability("EMP_PARTIAL", "2026-10", 176, 120);

  check(
    "Partial capacity",
    partial.availableHours === 56 && partial.status === "PARTIALLY_AVAILABLE",
  );

  // 3. Full release.
  const fullRelease = getCapacityGains([december, january]);

  check(
    "Full release",
    fullRelease.length === 1 &&
      fullRelease[0].type === "FULL_RELEASE" &&
      fullRelease[0].releasedHours === 112,
  );

  // 4. Partial release.
  const partialRelease = getCapacityGains([november, december]);

  check(
    "Partial release",
    partialRelease.length === 1 &&
      partialRelease[0].type === "PARTIAL_RELEASE" &&
      partialRelease[0].releasedHours === 56,
  );

  // 5. Capacity reduction is not a release.
  const reduction = getCapacityGains([
    createAvailability("EMP_R", "2026-10", 176, 56),
    createAvailability("EMP_R", "2026-11", 160, 120),
  ]);

  check("Capacity reduction", reduction.length === 0);

  // 6. Available by project start.
  const byStart = isAvailableByRequirementStart(
    [createAvailability("EMP_START", "2026-12", 176, 0)],
    "EMP_START",
    "2026-12-01",
  );

  check("Available by project start", byStart?.status === "AVAILABLE_BY_START");

  // 7. Not available by project start.
  const tooLate = isAvailableByRequirementStart(
    [
      createAvailability("EMP_LATE", "2026-12", 176, 176),
      createAvailability("EMP_LATE", "2027-01", 168, 0),
    ],
    "EMP_LATE",
    "2026-12-01",
  );

  check("Release too late", tooLate?.status === "NOT_AVAILABLE_BY_START");

  // 8. 15-day urgency.
  const today = new Date(2026, 9, 6);

  const urgent = getProjectPlanningPriority(
    createProject("2026-10-15"),
    today,
    "2027-03-31",
  );

  const upcoming = getProjectPlanningPriority(
    createProject("2026-12-01"),
    today,
    "2027-03-31",
  );

  check(
    "15-day planning priority",
    urgent.priority === "URGENT" &&
      upcoming.priority === "UPCOMING" &&
      urgent.priorityWindowDays === RESOURCE_PRIORITY_WINDOW_DAYS,
  );

  // 9. Filtered release forecast.
  const filteredRecords = [
    createAvailability("EMP_DS", "2026-11", 160, 160, "Data Science"),
    createAvailability("EMP_DS", "2026-12", 176, 80, "Data Science"),
    createAvailability("EMP_AI", "2026-11", 160, 160, "Applied AI"),
    createAvailability("EMP_AI", "2026-12", 176, 0, "Applied AI"),
  ];

  const dataScienceOnly = filteredRecords.filter(
    (record) => record.primaryCapability === "Data Science",
  );

  const forecast = getResourceReleaseForecast(dataScienceOnly);

  const decemberForecast = forecast.find((row) => row.monthKey === "2026-12");

  check(
    "Filtered release forecast",
    decemberForecast?.resourcesReleasing === 1 &&
      decemberForecast.capacityReleasedHours === 96,
  );

  // 10. Multiple project allocations.
  const multiProject = createAvailability("EMP_MULTI", "2026-12", 176, 80 + 40);

  check(
    "Multiple project allocations",
    multiProject.allocatedHours === 120 && multiProject.availableHours === 56,
  );

  // 11. Project end does not imply full availability.
  const continuingAllocation = createAvailability(
    "EMP_CONTINUING",
    "2026-12",
    176,
    80,
  );

  check(
    "Project end does not imply full availability",
    continuingAllocation.status === "PARTIALLY_AVAILABLE" &&
      continuingAllocation.availableHours === 96,
  );

  // 12. Year-boundary release.
  const expected = getExpectedRelease(records, "EMP_A", "2026-11");

  check(
    "December to January release continuity",
    expected?.nextCapacityIncreaseMonth === "2026-12" &&
      expected.fullAvailabilityMonth === "2027-01" &&
      expected.releaseEvents.length === 2,
  );

  return {
    isValid: errors.length === 0,
    passed,
    failed: errors.length,
    errors,
  };
}

export function logTimeAwareAvailabilityValidation(): void {
  const report = validateTimeAwareAvailability();

  if (report.isValid) {
    console.info(
      `[Resource Vision] Time-aware availability: ${report.passed} checks passed.`,
    );
    return;
  }

  console.error(
    `[Resource Vision] Time-aware availability: ${report.failed} checks failed.`,
  );

  for (const error of report.errors) {
    console.error(`[Resource Vision] ${error}`);
  }
}
