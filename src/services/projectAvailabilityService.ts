import type {
  Allocation,
  Employee,
  EmployeeMonthAvailability,
  Project,
} from "../types/domain";

import type {
  ProjectAvailabilityDetail,
  ProjectListRow,
  ProjectMonthlyEffort,
  ProjectResourceAllocationRow,
} from "../types/projectAvailability";

import type { AvailabilityQueryContext } from "./availabilityQueryService";

import { getAvailabilityForRange } from "./availabilityQueryService";

import { getMonthRange } from "./monthService";

type ProjectWithOptionalDimensions = Project & {
  primaryCapability?: unknown;
  secondaryCapability?: unknown;
  department?: unknown;
  location?: unknown;
};

function readProjectDimension(
  project: Project,
  key: "primaryCapability" | "secondaryCapability" | "department" | "location",
): string | undefined {
  const candidate = (project as ProjectWithOptionalDimensions)[key];

  if (typeof candidate !== "string") {
    return undefined;
  }

  const normalized = candidate.trim();

  return normalized === "" ? undefined : normalized;
}

function getProjectAllocations(
  allocations: Allocation[],
  projectId: string,
  monthKeys: string[],
): Allocation[] {
  const months = new Set(monthKeys);

  return allocations.filter(
    (allocation) =>
      allocation.projectId === projectId && months.has(allocation.monthKey),
  );
}

function buildEmployeeLookup(employees: Employee[]): Map<string, Employee> {
  return new Map(employees.map((employee) => [employee.employeeId, employee]));
}

function buildAvailabilityLookup(
  availability: EmployeeMonthAvailability[],
): Map<string, EmployeeMonthAvailability> {
  return new Map(
    availability.map((record) => [
      `${record.employeeId}::${record.monthKey}`,
      record,
    ]),
  );
}

export function getProjectMonthlyEffort(
  allocations: Allocation[],
  projectId: string,
  monthKey: string,
): ProjectMonthlyEffort {
  const matching = allocations.filter(
    (allocation) =>
      allocation.projectId === projectId && allocation.monthKey === monthKey,
  );

  return {
    monthKey,

    resourceCount: new Set(matching.map((allocation) => allocation.employeeId))
      .size,

    totalAllocatedHours: matching.reduce(
      (total, allocation) => total + allocation.allocatedHours,
      0,
    ),
  };
}

export function getProjectListRows(
  context: AvailabilityQueryContext,

  startMonth: string,

  numberOfMonths: number,

  focusMonth: string,
): ProjectListRow[] {
  const monthKeys = getMonthRange(startMonth, numberOfMonths);

  const monthSet = new Set(monthKeys);

  return context.projects
    .map((project) => {
      const allocations = context.plannedAllocations.filter(
        (allocation) =>
          allocation.projectId === project.projectId &&
          monthSet.has(allocation.monthKey),
      );

      const uniqueResources = new Set(
        allocations.map((allocation) => allocation.employeeId),
      );

      const focusMonthEffort = allocations
        .filter((allocation) => allocation.monthKey === focusMonth)
        .reduce((total, allocation) => total + allocation.allocatedHours, 0);

      return {
        projectId: project.projectId,

        proposalNumber: project.proposalNumber,

        projectName: project.projectName,

        projectStatus: project.projectStatus,

        startDate: project.startDate,

        endDate: project.endDate,

        resourceCount: uniqueResources.size,

        focusMonthEffort,

        primaryCapability: readProjectDimension(project, "primaryCapability"),

        secondaryCapability: readProjectDimension(
          project,
          "secondaryCapability",
        ),

        department: readProjectDimension(project, "department"),

        location: readProjectDimension(project, "location"),
      };
    })
    .sort((left, right) => left.projectName.localeCompare(right.projectName));
}

export function getProjectAvailabilityDetail(
  context: AvailabilityQueryContext,

  projectId: string,

  startMonth: string,

  numberOfMonths: number,
): ProjectAvailabilityDetail | null {
  const project = context.projects.find(
    (candidate) => candidate.projectId === projectId,
  );

  if (project === undefined) {
    return null;
  }

  const monthKeys = getMonthRange(startMonth, numberOfMonths);

  const allocations = getProjectAllocations(
    context.plannedAllocations,
    projectId,
    monthKeys,
  );

  const employeeLookup = buildEmployeeLookup(context.employees);

  /*
   * Overall employee availability comes from
   * Phase 2. It is not recalculated from this
   * project's allocations.
   */
  const overallAvailability = getAvailabilityForRange(
    context,
    startMonth,
    numberOfMonths,
  );

  const availabilityLookup = buildAvailabilityLookup(overallAvailability);

  const employeeIds = [
    ...new Set(allocations.map((allocation) => allocation.employeeId)),
  ];

  const resources: ProjectResourceAllocationRow[] = [];

  for (const employeeId of employeeIds) {
    const employee = employeeLookup.get(employeeId);

    if (employee === undefined) {
      continue;
    }

    const employeeAllocations = allocations.filter(
      (allocation) => allocation.employeeId === employeeId,
    );

    const months = monthKeys.map((monthKey) => ({
      monthKey,

      allocatedHours: employeeAllocations
        .filter((allocation) => allocation.monthKey === monthKey)
        .reduce((total, allocation) => total + allocation.allocatedHours, 0),
    }));

    const overall: Record<string, EmployeeMonthAvailability | null> = {};

    for (const monthKey of monthKeys) {
      overall[monthKey] =
        availabilityLookup.get(`${employeeId}::${monthKey}`) ?? null;
    }

    resources.push({
      employeeId: employee.employeeId,

      employeeName: employee.employeeName,

      primaryCapability: employee.primaryCapability,

      secondaryCapability: employee.secondaryCapability,

      department: employee.department,

      grade: employee.grade,

      location: employee.location,

      country: employee.country,

      months,

      totalAllocatedHours: months.reduce(
        (total, month) => total + month.allocatedHours,
        0,
      ),

      overallAvailability: overall,
    });
  }

  resources.sort((left, right) =>
    left.employeeName.localeCompare(right.employeeName),
  );

  const monthlyEffort = monthKeys.map((monthKey) =>
    getProjectMonthlyEffort(allocations, projectId, monthKey),
  );

  return {
    project,

    resources,

    monthlyEffort,

    uniqueResourceCount: resources.length,
  };
}
