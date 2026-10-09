import type {
  EmployeeMonthAvailability,
  Project,
} from "./domain";

export interface ProjectResourceMonthAllocation {
  monthKey: string;
  allocatedHours: number;
}

export interface ProjectResourceAllocationRow {
  employeeId: string;
  employeeName: string;

  primaryCapability: string;
  secondaryCapability: string;

  department: string;
  grade: string;

  location: string;
  country: string;

  months:
    ProjectResourceMonthAllocation[];

  totalAllocatedHours: number;

  overallAvailability:
    Record<
      string,
      EmployeeMonthAvailability | null
    >;
}

export interface ProjectMonthlyEffort {
  monthKey: string;

  resourceCount: number;

  totalAllocatedHours: number;
}

export interface ProjectAvailabilityDetail {
  project: Project;

  resources:
    ProjectResourceAllocationRow[];

  monthlyEffort:
    ProjectMonthlyEffort[];

  uniqueResourceCount: number;
}

export interface ProjectListRow {
  projectId: string;

  proposalNumber: string;
  projectName: string;

  projectStatus: string;

  startDate: string;
  endDate: string;

  resourceCount: number;

  focusMonthEffort: number;

  /**
   * These values are populated only when the
   * canonical Project itself genuinely exposes
   * project-level metadata.
   *
   * They are never inferred from employees.
   */
  primaryCapability?: string;
  secondaryCapability?: string;
  department?: string;
  location?: string;
}