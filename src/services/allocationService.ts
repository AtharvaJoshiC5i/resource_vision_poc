import type {
  Allocation,
  Project,
  ProjectAllocationBreakdown,
} from "../types/domain";

export function getEmployeeMonthAllocations(
  allocations: Allocation[],
  employeeId: string,
  monthKey: string,
): Allocation[] {
  return allocations.filter(
    (allocation) =>
      allocation.employeeId === employeeId && allocation.monthKey === monthKey,
  );
}

export function getAllocatedHours(allocations: Allocation[]): number {
  return allocations.reduce((total, allocation) => {
    if (!Number.isFinite(allocation.allocatedHours)) {
      throw new Error(
        `Allocation for employee ${allocation.employeeId}, project ${allocation.projectId}, month ${allocation.monthKey} has invalid allocatedHours.`,
      );
    }

    if (allocation.allocatedHours < 0) {
      throw new Error(
        `Allocation for employee ${allocation.employeeId}, project ${allocation.projectId}, month ${allocation.monthKey} has negative allocatedHours=${allocation.allocatedHours}.`,
      );
    }

    return total + allocation.allocatedHours;
  }, 0);
}

export function getProjectAllocationBreakdown(
  allocations: Allocation[],
  projects: Project[],
): ProjectAllocationBreakdown[] {
  const projectsById = new Map(
    projects.map((project) => [project.projectId, project]),
  );

  const grouped = new Map<string, number>();

  for (const allocation of allocations) {
    grouped.set(
      allocation.projectId,

      (grouped.get(allocation.projectId) ?? 0) + allocation.allocatedHours,
    );
  }

  return [...grouped.entries()]
    .map(([projectId, allocatedHours]) => {
      const project = projectsById.get(projectId);

      return {
        projectId,

        projectName: project?.projectName ?? (projectId || "Unknown Project"),

        proposalNumber: project?.proposalNumber ?? "",

        allocatedHours,

        projectStartDate: project?.startDate,

        projectEndDate: project?.endDate,
      };
    })
    .sort((left, right) => right.allocatedHours - left.allocatedHours);
}
