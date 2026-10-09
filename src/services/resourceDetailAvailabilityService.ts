import type {
  Allocation,
  Employee,
  EmployeeMonthAvailability,
  Project,
} from "../types/domain";

import {
  getEmployeeAvailabilityRange,
} from "./availabilityQueryService";

import type {
  AvailabilityQueryContext,
} from "./availabilityQueryService";

import {
  getUpcomingAvailabilityTransitions,
} from "./upcomingAvailabilityService";

export interface EmployeeProjectCommitment {
  project: Project;

  months: {
    monthKey: string;
    allocatedHours: number;
  }[];

  totalAllocatedHours: number;
}

export interface ResourceDetailAvailability {
  employee: Employee;

  availability:
    EmployeeMonthAvailability[];

  projectCommitments:
    EmployeeProjectCommitment[];

  transitions:
    ReturnType<
      typeof getUpcomingAvailabilityTransitions
    >;
}

function getEmployeeAllocations(
  allocations: Allocation[],
  employeeId: string,
  monthKeys: string[],
): Allocation[] {
  const monthSet =
    new Set(monthKeys);

  return allocations.filter(
    (allocation) =>
      allocation.employeeId ===
        employeeId &&
      monthSet.has(
        allocation.monthKey,
      ),
  );
}

function buildProjectCommitments(
  employeeId: string,
  monthKeys: string[],
  allocations: Allocation[],
  projects: Project[],
): EmployeeProjectCommitment[] {
  const employeeAllocations =
    getEmployeeAllocations(
      allocations,
      employeeId,
      monthKeys,
    );

  const projectLookup =
    new Map(
      projects.map(
        (project) => [
          project.projectId,
          project,
        ],
      ),
    );

  const grouped =
    new Map<
      string,
      Allocation[]
    >();

  for (
    const allocation
    of employeeAllocations
  ) {
    const existing =
      grouped.get(
        allocation.projectId,
      ) ?? [];

    existing.push(
      allocation,
    );

    grouped.set(
      allocation.projectId,
      existing,
    );
  }

  const result:
    EmployeeProjectCommitment[] =
    [];

  for (
    const [
      projectId,
      projectAllocations,
    ]
    of grouped.entries()
  ) {
    const project =
      projectLookup.get(
        projectId,
      );

    if (project === undefined) {
      continue;
    }

    const monthTotals =
      new Map<
        string,
        number
      >();

    for (
      const allocation
      of projectAllocations
    ) {
      monthTotals.set(
        allocation.monthKey,

        (monthTotals.get(
          allocation.monthKey,
        ) ?? 0) +
          allocation.allocatedHours,
      );
    }

    const months =
      [
        ...monthTotals.entries(),
      ]
        .map(
          ([
            monthKey,
            allocatedHours,
          ]) => ({
            monthKey,
            allocatedHours,
          }),
        )
        .sort(
          (left, right) =>
            left.monthKey.localeCompare(
              right.monthKey,
            ),
        );

    result.push({
      project,

      months,

      totalAllocatedHours:
        months.reduce(
          (total, month) =>
            total +
            month.allocatedHours,
          0,
        ),
    });
  }

  return result.sort(
    (left, right) =>
      left.project.projectName.localeCompare(
        right.project.projectName,
      ),
  );
}

export function getResourceDetailAvailability(
  context:
    AvailabilityQueryContext,

  employeeId: string,

  startMonth: string,

  numberOfMonths: number,
): ResourceDetailAvailability | null {
  const employee =
    context.employees.find(
      (candidate) =>
        candidate.employeeId ===
        employeeId,
    );

  if (employee === undefined) {
    return null;
  }

  const availability =
    getEmployeeAvailabilityRange(
      context,
      employeeId,
      startMonth,
      numberOfMonths,
    );

  const monthKeys =
    availability.map(
      (record) =>
        record.monthKey,
    );

  /*
   * Phase 6 focuses on current/future planning.
   *
   * Historical Famstack functionality remains
   * elsewhere and is not redesigned here.
   */
  const projectCommitments =
    buildProjectCommitments(
      employeeId,
      monthKeys,

      context.plannedAllocations,

      context.projects,
    );

  const transitions =
    getUpcomingAvailabilityTransitions(
      availability,
    );

  return {
    employee,
    availability,
    projectCommitments,
    transitions,
  };
}