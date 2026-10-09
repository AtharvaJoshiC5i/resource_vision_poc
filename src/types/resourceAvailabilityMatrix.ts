import type {
  AvailabilityStatus,
  EmployeeMonthAvailability,
  ProjectAllocationBreakdown,
} from "./domain";

export type ResourceMatrixStatusFilter =
  | "ALL"
  | "WITH_CAPACITY"
  | AvailabilityStatus;

export type ResourceMatrixSortField =
  | "employeeName"
  | "availableHours"
  | "primaryCapability"
  | "grade"
  | "allocatedUntil";

export type ResourceMatrixSortDirection = "asc" | "desc";

export interface ResourceMatrixSort {
  field: ResourceMatrixSortField;
  direction: ResourceMatrixSortDirection;
}

export interface ResourceMatrixMonth {
  monthKey: string;

  availability: EmployeeMonthAvailability | null;
}

export interface ResourceMatrixProjectSummary {
  projectId: string;
  projectName: string;
  proposalNumber: string;

  allocatedHours: number;

  projectStartDate?: string;
  projectEndDate?: string;
}

export interface ResourceAvailabilityMatrixRow {
  employeeId: string;
  employeeName: string;

  primaryCapability: string;
  secondaryCapability: string;

  department: string;
  grade: string;

  location: string;
  country: string;

  months: ResourceMatrixMonth[];

  projects: ResourceMatrixProjectSummary[];

  allocatedUntil?: string;

  focusMonthAvailability: EmployeeMonthAvailability | null;

  firstFullAvailabilityMonth?: string;

  firstCapacityGainMonth?: string;
}

export interface ResourceAvailabilityMatrixFilters {
  search: string;

  status: ResourceMatrixStatusFilter;
}

export interface ResourceAvailabilityMatrixSummary {
  totalResources: number;

  resourcesWithCapacity: number;

  totalAvailableHours: number;

  focusMonth: string;
}

export interface AvailabilityCellExplanation {
  employeeId: string;
  employeeName: string;

  monthKey: string;

  totalCapacityHours: number;
  allocatedHours: number;
  availableHours: number;

  status: AvailabilityStatus;

  projectAllocations: ProjectAllocationBreakdown[];
}
