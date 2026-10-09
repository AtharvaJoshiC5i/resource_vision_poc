import type {
  Allocation,
  Employee,
  Project,
  WorkCalendar,
} from "../types/domain";

import {
  calculateEmployeeMonthAvailability,
} from "./availabilityService";

import {
  getUpcomingAvailabilityTransitions,
} from "./upcomingAvailabilityService";

function assert(
  condition: boolean,
  message: string,
): void {
  if (!condition) {
    throw new Error(
      `[Resource Vision] Availability V1 validation failed: ${message}`,
    );
  }
}

const employee: Employee = {
  employeeId:
    "VALIDATION_AARAV",

  employeeName:
    "Aarav Mehta",

  employeeStatus:
    "ACTIVE",

  dateOfJoining:
    "2024-01-01",

  primaryCapability:
    "Applied AI",

  secondaryCapability:
    "GenAI",

  department:
    "AI Solutions",

  grade: "D1",

  location:
    "Bengaluru",

  country:
    "India",

  ftePercentage:
    1,
};

const projects: Project[] = [
  {
    projectId:
      "ALPHA",

    proposalNumber:
      "PROP-ALPHA",

    projectName:
      "Project Alpha",

    projectStatus:
      "Active",

    startDate:
      "2026-01-01",

    endDate:
      "2026-12-31",
  },

  {
    projectId:
      "BETA",

    proposalNumber:
      "PROP-BETA",

    projectName:
      "Project Beta",

    projectStatus:
      "Active",

    startDate:
      "2026-01-01",

    endDate:
      "2026-12-31",
  },

  {
    projectId:
      "GAMMA",

    proposalNumber:
      "PROP-GAMMA",

    projectName:
      "Project Gamma",

    projectStatus:
      "Active",

    startDate:
      "2027-01-01",

    endDate:
      "2027-06-30",
  },
];

function calendar(
  monthKey: string,
  workingDays: number,
): WorkCalendar {
  return {
    country:
      "India",

    location:
      "Bengaluru",

    monthKey,

    workingDays,

    hoursPerDay: 8,

    monthlyCapacity:
      workingDays * 8,
  };
}

function allocation(
  projectId: string,
  monthKey: string,
  allocatedHours: number,
): Allocation {
  return {
    employeeId:
      employee.employeeId,

    projectId,

    monthKey,

    allocatedHours,

    source:
      "PROJECT_TRACK",
  };
}

export function validateAvailabilityV1(): void {
  /*
   * SCENARIO 1
   *
   * Nov: 160 - 80 - 80 = 0
   * Dec: 176 - 80 - 40 = 56
   * Jan: 176 - 0 = 176
   */
  const november =
    calculateEmployeeMonthAvailability({
      employee,

      monthKey:
        "2026-11",

      workCalendar:
        calendar(
          "2026-11",
          20,
        ),

      allocations: [
        allocation(
          "ALPHA",
          "2026-11",
          80,
        ),

        allocation(
          "BETA",
          "2026-11",
          80,
        ),
      ],

      projects,
    });

  const december =
    calculateEmployeeMonthAvailability({
      employee,

      monthKey:
        "2026-12",

      workCalendar:
        calendar(
          "2026-12",
          22,
        ),

      allocations: [
        allocation(
          "ALPHA",
          "2026-12",
          80,
        ),

        allocation(
          "BETA",
          "2026-12",
          40,
        ),
      ],

      projects,
    });

  const january =
    calculateEmployeeMonthAvailability({
      employee,

      monthKey:
        "2027-01",

      workCalendar:
        calendar(
          "2027-01",
          22,
        ),

      allocations: [],

      projects,
    });

  assert(
    november.availableHours ===
      0 &&
      november.status ===
        "FULLY_ALLOCATED",
    "Scenario 1 November must be 0h / Fully Allocated.",
  );

  assert(
    december.availableHours ===
      56 &&
      december.status ===
        "PARTIALLY_AVAILABLE",
    "Scenario 1 December must be 56h / Partially Available.",
  );

  assert(
    january.availableHours ===
      176 &&
      january.status ===
        "AVAILABLE",
    "Scenario 1 January must be 176h / Available.",
  );

  const transitions =
    getUpcomingAvailabilityTransitions(
      [
        november,
        december,
        january,
      ],
    );

  assert(
    transitions.some(
      (transition) =>
        transition.toMonthKey ===
          "2026-12" &&
        transition.additionalAvailableHours ===
          56,
    ),
    "Scenario 1 December must gain 56h.",
  );

  assert(
    transitions.some(
      (transition) =>
        transition.toMonthKey ===
          "2027-01" &&
        transition.additionalAvailableHours ===
          120 &&
        transition.transitionTypes.includes(
          "BECAME_FULLY_AVAILABLE",
        ),
    ),
    "Scenario 1 January must gain 120h and become fully available.",
  );

  /*
   * SCENARIO 2
   *
   * 176 - 100 - 100 = -24
   */
  const overAllocated =
    calculateEmployeeMonthAvailability({
      employee,

      monthKey:
        "2026-12",

      workCalendar:
        calendar(
          "2026-12",
          22,
        ),

      allocations: [
        allocation(
          "ALPHA",
          "2026-12",
          100,
        ),

        allocation(
          "GAMMA",
          "2026-12",
          100,
        ),
      ],

      projects,
    });

  assert(
    overAllocated.allocatedHours ===
      200 &&
      overAllocated.availableHours ===
        -24 &&
      overAllocated.status ===
        "OVER_ALLOCATED",
    "Scenario 2 must preserve 200h allocated, -24h available and Over-Allocated.",
  );

  /*
   * SCENARIO 3
   *
   * Alpha ends December, but Gamma consumes
   * 80h in January.
   *
   * 176 - 80 = 96
   *
   * Project end date must not manufacture
   * full availability.
   */
  const januaryWithGamma =
    calculateEmployeeMonthAvailability({
      employee,

      monthKey:
        "2027-01",

      workCalendar:
        calendar(
          "2027-01",
          22,
        ),

      allocations: [
        allocation(
          "GAMMA",
          "2027-01",
          80,
        ),
      ],

      projects,
    });

  assert(
    januaryWithGamma.availableHours ===
      96 &&
      januaryWithGamma.status ===
        "PARTIALLY_AVAILABLE",
    "Scenario 3 January must be 96h / Partially Available, not 176h.",
  );
}