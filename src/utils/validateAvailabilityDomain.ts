import type {
  Allocation,
  Employee,
  Project,
  WorkCalendar,
} from "../types/domain";

import { calculateEmployeeMonthAvailability } from "../services/availabilityService";

import { getAvailabilityForRange } from "../services/availabilityQueryService";

import { getMonthRange } from "../services/monthService";

import { getUpcomingAvailabilityTransitions } from "../services/upcomingAvailabilityService";

const baseEmployee: Employee = {
  employeeId: "VALIDATION_EMP",

  employeeName: "Validation Employee",

  employeeStatus: "ACTIVE",

  dateOfJoining: "2020-01-01",

  primaryCapability: "Validation",

  secondaryCapability: "Validation",

  department: "Validation",

  grade: "Validation",

  location: "Validation",

  country: "Validation",

  ftePercentage: 1,
};

const projects: Project[] = [
  {
    projectId: "A",

    proposalNumber: "A",

    projectName: "Project Alpha",

    projectStatus: "Active",

    startDate: "2026-01-01",

    endDate: "2027-12-31",
  },

  {
    projectId: "B",

    proposalNumber: "B",

    projectName: "Project Beta",

    projectStatus: "Active",

    startDate: "2026-01-01",

    endDate: "2027-12-31",
  },
];

function calendar(monthKey: string, workingDays: number): WorkCalendar {
  return {
    country: "Validation",

    location: "Validation",

    monthKey,

    workingDays,

    hoursPerDay: 8,

    monthlyCapacity: workingDays * 8,
  };
}

function allocation(
  projectId: string,
  monthKey: string,
  allocatedHours: number,
): Allocation {
  return {
    employeeId: baseEmployee.employeeId,

    projectId,

    monthKey,

    allocatedHours,

    source: "PROJECT_TRACK",
  };
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(
      `[Resource Vision] Availability domain validation failed: ${message}`,
    );
  }
}

function assertClose(actual: number, expected: number, message: string): void {
  assert(
    Math.abs(actual - expected) < 0.001,

    `${message}. Expected ${expected}, received ${actual}.`,
  );
}

export function validateAvailabilityDomain(): void {
  /*
   * CASE 1 — FULLY AVAILABLE
   */
  const fullyAvailable = calculateEmployeeMonthAvailability({
    employee: baseEmployee,

    monthKey: "2026-10",

    workCalendar: calendar("2026-10", 22),

    allocations: [],

    projects,
  });

  assert(
    fullyAvailable.allocatedHours === 0,

    "Case 1 allocated hours",
  );

  assert(
    fullyAvailable.availableHours === 176,

    "Case 1 available hours",
  );

  assert(
    fullyAvailable.blockedHours === 0,

    "Case 1 blocked hours",
  );

  assert(
    fullyAvailable.availableToPromiseHours === 176,

    "Case 1 available-to-promise",
  );

  assertClose(
    fullyAvailable.availabilityPercentage,

    100,

    "Case 1 availability percentage",
  );

  assert(
    fullyAvailable.status === "AVAILABLE",

    "Case 1 status",
  );

  /*
   * CASE 2 — PARTIAL / MULTIPLE PROJECTS
   */
  const partial = calculateEmployeeMonthAvailability({
    employee: baseEmployee,

    monthKey: "2026-10",

    workCalendar: calendar("2026-10", 22),

    allocations: [
      allocation("A", "2026-10", 80),

      allocation("B", "2026-10", 40),
    ],

    projects,
  });

  assert(
    partial.allocatedHours === 120,

    "Case 2 allocated hours",
  );

  assert(
    partial.availableHours === 56,

    "Case 2 available hours",
  );

  assert(
    partial.availableToPromiseHours === 56,

    "Case 2 available-to-promise",
  );

  assertClose(
    partial.availabilityPercentage,

    (56 / 176) * 100,

    "Case 2 availability percentage",
  );

  assert(
    partial.status === "PARTIALLY_AVAILABLE",

    "Case 2 status",
  );

  assert(
    partial.projectAllocations.length === 2,

    "Case 2 project breakdown",
  );

  /*
   * CASE 3 — FULLY ALLOCATED
   */
  const fullyAllocated = calculateEmployeeMonthAvailability({
    employee: baseEmployee,

    monthKey: "2026-10",

    workCalendar: calendar("2026-10", 22),

    allocations: [allocation("A", "2026-10", 176)],

    projects,
  });

  assert(
    fullyAllocated.availableHours === 0,

    "Case 3 available hours",
  );

  assertClose(
    fullyAllocated.availabilityPercentage,

    0,

    "Case 3 availability percentage",
  );

  assert(
    fullyAllocated.status === "FULLY_ALLOCATED",

    "Case 3 status",
  );

  /*
   * CASE 4 — OVER ALLOCATED
   */
  const overAllocated = calculateEmployeeMonthAvailability({
    employee: baseEmployee,

    monthKey: "2026-10",

    workCalendar: calendar("2026-10", 22),

    allocations: [allocation("A", "2026-10", 200)],

    projects,
  });

  assert(
    overAllocated.availableHours === -24,

    "Case 4 available hours",
  );

  assert(
    overAllocated.availabilityPercentage < 0,

    "Case 4 availability percentage should remain negative",
  );

  assert(
    overAllocated.status === "OVER_ALLOCATED",

    "Case 4 status",
  );

  /*
   * CASE 5 — DIFFERENT MONTH CAPACITY
   */
  const november = calculateEmployeeMonthAvailability({
    employee: baseEmployee,

    monthKey: "2026-11",

    workCalendar: calendar("2026-11", 20),

    allocations: [allocation("A", "2026-11", 120)],

    projects,
  });

  const december = calculateEmployeeMonthAvailability({
    employee: baseEmployee,

    monthKey: "2026-12",

    workCalendar: calendar("2026-12", 22),

    allocations: [allocation("A", "2026-12", 120)],

    projects,
  });

  assert(
    november.totalCapacityHours === 160,

    "Case 5 November capacity",
  );

  assert(
    november.availableHours === 40,

    "Case 5 November availability",
  );

  assert(
    december.totalCapacityHours === 176,

    "Case 5 December capacity",
  );

  assert(
    december.availableHours === 56,

    "Case 5 December availability",
  );

  /*
   * CASE 6 — FTE
   */
  const halfFteEmployee: Employee = {
    ...baseEmployee,

    employeeId: "VALIDATION_HALF_FTE",

    ftePercentage: 0.5,
  };

  const halfFte = calculateEmployeeMonthAvailability({
    employee: halfFteEmployee,

    monthKey: "2026-12",

    workCalendar: calendar("2026-12", 22),

    allocations: [
      {
        employeeId: halfFteEmployee.employeeId,

        projectId: "A",

        monthKey: "2026-12",

        allocatedHours: 40,

        source: "PROJECT_TRACK",
      },
    ],

    projects,
  });

  assert(
    halfFte.totalCapacityHours === 88,

    "Case 6 FTE capacity",
  );

  assert(
    halfFte.availableHours === 48,

    "Case 6 FTE availability",
  );

  /*
   * CASE 7 — YEAR BOUNDARY
   *
   * Verify that the shared month utility
   * crosses the 2026 -> 2027 boundary.
   */
  const range = getMonthRange("2026-11", 4);

  assert(
    JSON.stringify(range) ===
      JSON.stringify(["2026-11", "2026-12", "2027-01", "2027-02"]),

    "Case 7 year-boundary month range",
  );

  /*
   * CASE 8 — UPCOMING AVAILABILITY
   *
   * Nov:
   * 160 - 160 = 0
   *
   * Dec:
   * 176 - 120 = 56
   *
   * Jan:
   * 176 - 0 = 176
   *
   * The transition service should detect
   * both the December gain and the January
   * full-availability transition.
   */
  const transitionEmployee = baseEmployee;

  const transitionRecords = [
    calculateEmployeeMonthAvailability({
      employee: transitionEmployee,

      monthKey: "2026-11",

      workCalendar: calendar("2026-11", 20),

      allocations: [allocation("A", "2026-11", 160)],

      projects,
    }),

    calculateEmployeeMonthAvailability({
      employee: transitionEmployee,

      monthKey: "2026-12",

      workCalendar: calendar("2026-12", 22),

      allocations: [allocation("A", "2026-12", 120)],

      projects,
    }),

    calculateEmployeeMonthAvailability({
      employee: transitionEmployee,

      monthKey: "2027-01",

      workCalendar: calendar("2027-01", 22),

      allocations: [],

      projects,
    }),
  ];

  const transitions = getUpcomingAvailabilityTransitions(transitionRecords);

  assert(
    transitionRecords[0].status === "FULLY_ALLOCATED",

    "Case 8 November status",
  );

  assert(
    transitionRecords[1].status === "PARTIALLY_AVAILABLE",

    "Case 8 December status",
  );

  assert(
    transitionRecords[2].status === "AVAILABLE",

    "Case 8 January status",
  );

  assert(
    transitions.length === 2,

    "Case 8 should identify two availability transitions",
  );

  assert(
    transitions.some(
      (transition) =>
        transition.toMonthKey === "2026-12" &&
        transition.additionalAvailableHours === 56,
    ),

    "Case 8 December should gain 56 hours",
  );

  assert(
    transitions.some(
      (transition) =>
        transition.toMonthKey === "2027-01" &&
        transition.additionalAvailableHours === 120,
    ),

    "Case 8 January should gain 120 hours",
  );

  /*
   * CASE 9 — NOT YET JOINED
   */
  const futureEmployee: Employee = {
    ...baseEmployee,

    employeeId: "VALIDATION_FUTURE",

    dateOfJoining: "2027-01-15",
  };

  const futureResult = getAvailabilityForRange(
    {
      employees: [futureEmployee],

      projects,

      historicalAllocations: [],

      plannedAllocations: [],

      workCalendar: [calendar("2026-12", 22)],
    },

    "2026-12",

    1,
  );

  assert(
    futureResult.length === 0,

    "Case 9 not-yet-joined employee should not appear as available workforce",
  );

  /*
   * CASE 10 — EXITED
   */
  const exitedEmployee: Employee = {
    ...baseEmployee,

    employeeId: "VALIDATION_EXITED",

    lastWorkingDate: "2026-11-30",
  };

  const exitedResult = getAvailabilityForRange(
    {
      employees: [exitedEmployee],

      projects,

      historicalAllocations: [],

      plannedAllocations: [],

      workCalendar: [calendar("2027-01", 21)],
    },

    "2027-01",

    1,
  );

  assert(
    exitedResult.length === 0,

    "Case 10 exited employee should not appear as available workforce",
  );

  /*
   * CASE 11 — ZERO CAPACITY
   */
  const zeroCapacity = calculateEmployeeMonthAvailability({
    employee: baseEmployee,

    monthKey: "2026-10",

    workCalendar: calendar("2026-10", 0),

    allocations: [],

    projects,
  });

  assert(
    zeroCapacity.availabilityPercentage === 0,

    "Case 11 zero capacity percentage",
  );

  assert(
    Number.isFinite(zeroCapacity.availabilityPercentage),

    "Case 11 availability percentage must remain finite",
  );

  assert(
    Number.isFinite(zeroCapacity.utilizationPercentage),

    "Case 11 utilization percentage must remain finite",
  );

  /*
   * CASE 12 — JANUARY 2027
   *
   * Explicitly verify that the new planning
   * calendar is usable by the same engine.
   *
   * 168 capacity - 80 allocated = 88 available.
   */
  const january2027 = calculateEmployeeMonthAvailability({
    employee: baseEmployee,

    monthKey: "2027-01",

    workCalendar: calendar("2027-01", 21),

    allocations: [allocation("A", "2027-01", 80)],

    projects,
  });

  assert(
    january2027.totalCapacityHours === 168,

    "Case 12 January 2027 capacity",
  );

  assert(
    january2027.allocatedHours === 80,

    "Case 12 January 2027 allocated hours",
  );

  assert(
    january2027.availableHours === 88,

    "Case 12 January 2027 available hours",
  );

  assert(
    january2027.status === "PARTIALLY_AVAILABLE",

    "Case 12 January 2027 status",
  );

  /*
   * CASE 13 — FEBRUARY 2027
   *
   * 160 capacity - 120 allocated = 40 available.
   */
  const february2027 = calculateEmployeeMonthAvailability({
    employee: baseEmployee,

    monthKey: "2027-02",

    workCalendar: calendar("2027-02", 20),

    allocations: [allocation("A", "2027-02", 120)],

    projects,
  });

  assert(
    february2027.totalCapacityHours === 160,

    "Case 13 February 2027 capacity",
  );

  assert(
    february2027.allocatedHours === 120,

    "Case 13 February 2027 allocated hours",
  );

  assert(
    february2027.availableHours === 40,

    "Case 13 February 2027 available hours",
  );

  assert(
    february2027.status === "PARTIALLY_AVAILABLE",

    "Case 13 February 2027 status",
  );

  /*
   * CASE 14 — MARCH 2027
   *
   * 184 capacity - 80 allocated = 104 available.
   *
   * This explicitly validates the final month
   * of the extended planning horizon.
   */
  const march2027 = calculateEmployeeMonthAvailability({
    employee: baseEmployee,

    monthKey: "2027-03",

    workCalendar: calendar("2027-03", 23),

    allocations: [allocation("A", "2027-03", 80)],

    projects,
  });

  assert(
    march2027.totalCapacityHours === 184,

    "Case 14 March 2027 capacity",
  );

  assert(
    march2027.allocatedHours === 80,

    "Case 14 March 2027 allocated hours",
  );

  assert(
    march2027.availableHours === 104,

    "Case 14 March 2027 available hours",
  );

  assert(
    march2027.status === "PARTIALLY_AVAILABLE",

    "Case 14 March 2027 status",
  );

  /*
   * CASE 15 — FULL EXTENDED PLANNING RANGE
   *
   * Verify that the same month utility can
   * produce the full Sep 2026 -> Mar 2027
   * planning sequence.
   */
  const extendedRange = getMonthRange("2026-09", 7);

  assert(
    JSON.stringify(extendedRange) ===
      JSON.stringify([
        "2026-09",
        "2026-10",
        "2026-11",
        "2026-12",
        "2027-01",
        "2027-02",
        "2027-03",
      ]),

    "Case 15 extended planning range",
  );

  /*
   * CASE 16 — MULTI-MONTH 2027 TRANSITIONS
   *
   * Dec:
   * 176 - 120 = 56
   *
   * Jan:
   * 168 - 80 = 88
   *
   * Feb:
   * 160 - 120 = 40
   *
   * Mar:
   * 184 - 80 = 104
   *
   * This confirms the transition service works
   * continuously across the year boundary and
   * through the entire new horizon.
   */
  const extendedTransitionRecords = [
    calculateEmployeeMonthAvailability({
      employee: transitionEmployee,

      monthKey: "2026-12",

      workCalendar: calendar("2026-12", 22),

      allocations: [allocation("A", "2026-12", 120)],

      projects,
    }),

    january2027,

    february2027,

    march2027,
  ];

  const extendedTransitions = getUpcomingAvailabilityTransitions(
    extendedTransitionRecords,
  );

  assert(
    extendedTransitions.length === 2,

    "Case 16 should identify only positive availability transitions",
  );

  assert(
    extendedTransitions.some(
      (transition) =>
        transition.fromMonthKey === "2026-12" &&
        transition.toMonthKey === "2027-01" &&
        transition.additionalAvailableHours === 32,
    ),

    "Case 16 December to January transition should gain 32 hours",
  );

  assert(
    extendedTransitions.some(
      (transition) =>
        transition.fromMonthKey === "2027-02" &&
        transition.toMonthKey === "2027-03" &&
        transition.additionalAvailableHours === 64,
    ),

    "Case 16 February to March transition should gain 64 hours",
  );

  /*
   * CASE 17 — ZERO ALLOCATION IN 2027
   *
   * A resource with zero allocation in a
   * valid future month must be fully available,
   * not missing.
   */
  const fullyAvailableMarch2027 = calculateEmployeeMonthAvailability({
    employee: baseEmployee,

    monthKey: "2027-03",

    workCalendar: calendar("2027-03", 23),

    allocations: [],

    projects,
  });

  assert(
    fullyAvailableMarch2027.totalCapacityHours === 184,

    "Case 17 March 2027 capacity",
  );

  assert(
    fullyAvailableMarch2027.allocatedHours === 0,

    "Case 17 March 2027 allocated hours",
  );

  assert(
    fullyAvailableMarch2027.availableHours === 184,

    "Case 17 March 2027 available hours",
  );

  assertClose(
    fullyAvailableMarch2027.availabilityPercentage,

    100,

    "Case 17 March 2027 availability percentage",
  );

  assert(
    fullyAvailableMarch2027.status === "AVAILABLE",

    "Case 17 March 2027 status",
  );
}
