export type EmployeeStatus = "ACTIVE" | "INACTIVE";

export type WorkforceState = "ACTIVE" | "NOT_JOINED" | "EXITED";

export type AllocationSource = "FAMSTACK" | "PROJECT_TRACK";

export type AvailabilityStatus =
  | "AVAILABLE"
  | "PARTIALLY_AVAILABLE"
  | "FULLY_ALLOCATED"
  | "OVER_ALLOCATED";

export interface Employee {
  employeeId: string;
  employeeName: string;

  employeeStatus: EmployeeStatus;

  dateOfJoining: string;
  lastWorkingDate?: string;

  primaryCapability: string;
  secondaryCapability: string;

  department: string;
  grade: string;

  location: string;
  country: string;

  /**
   * 1 = 100% FTE.
   *
   * Current POC source data does not contain an
   * authoritative FTE percentage, so the source
   * normalization layer currently defaults this
   * to 1.
   */
  ftePercentage: number;
}

export interface Project {
  projectId: string;
  proposalNumber: string;
  projectName: string;

  projectStatus: string;

  startDate: string;
  endDate: string;
}

export interface Allocation {
  employeeId: string;
  projectId: string;

  monthKey: string;

  allocatedHours: number;

  source: AllocationSource;
}

export interface HistoricalActivity {
  employeeId: string;
  projectId: string;

  monthKey: string;

  actualEffortHours: number;

  workCategory: string;
}

export interface WorkCalendar {
  country: string;
  location: string;

  monthKey: string;

  workingDays: number;
  hoursPerDay: number;

  monthlyCapacity: number;
}

export interface ProjectAllocationBreakdown {
  projectId: string;
  projectName: string;
  proposalNumber: string;

  allocatedHours: number;

  projectStartDate?: string;
  projectEndDate?: string;
}

export interface EmployeeMonthAvailability {
  employeeId: string;
  employeeName: string;

  monthKey: string;

  workforceState: WorkforceState;

  totalCapacityHours: number;

  allocatedHours: number;

  /**
   * Resource blocking is deliberately not implemented
   * in Availability V1 / Phase 2.
   */
  blockedHours: number;

  availableHours: number;

  availableToPromiseHours: number;

  availabilityPercentage: number;

  utilizationPercentage: number;

  status: AvailabilityStatus;

  source: AllocationSource;

  projectAllocations: ProjectAllocationBreakdown[];

  primaryCapability: string;
  secondaryCapability: string;

  department: string;
  grade: string;

  location: string;
  country: string;
}

export interface MonthlyAvailabilitySummary {
  monthKey: string;

  totalResources: number;

  /**
   * Resources with usable capacity.
   *
   * Includes:
   * AVAILABLE
   * +
   * PARTIALLY_AVAILABLE
   */
  resourcesWithCapacity: number;

  fullyAvailableResources: number;

  partiallyAvailableResources: number;

  fullyAllocatedResources: number;

  overAllocatedResources: number;

  totalCapacityHours: number;

  totalAllocatedHours: number;

  totalAvailableHours: number;

  totalAvailableToPromiseHours: number;
}

export type AvailabilityTransitionType =
  | "GAINED_CAPACITY"
  | "BECAME_FULLY_AVAILABLE"
  | "FULLY_ALLOCATED_TO_PARTIAL"
  | "PARTIAL_TO_FULLY_AVAILABLE";

export interface AvailabilityTransition {
  employeeId: string;
  employeeName: string;

  fromMonthKey: string;
  toMonthKey: string;

  fromStatus: AvailabilityStatus;
  toStatus: AvailabilityStatus;

  previousAvailableHours: number;
  currentAvailableHours: number;

  additionalAvailableHours: number;

  transitionTypes: AvailabilityTransitionType[];
}
