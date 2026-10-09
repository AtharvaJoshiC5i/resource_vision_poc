import type {
  AvailabilityStatus,
  ResourceMonthlyRecord,
} from "./resourceMonthly";

export interface ResourceEmployeeDetail {
  employeeId: string;
  employeeName: string;

  primaryCapability: string;
  secondaryCapability: string;
  department: string;
  grade: string;
  location: string;
  country: string;

  employmentStatus: string;
  dateOfJoining: string;
  dateOfLeaving?: string;
}

export interface ResourceAllocationMonth {
  monthKey: string;
  effortHours: number;
}

export interface ResourceProjectAllocation {
  projectId: string;
  proposalNumber: string;
  projectName: string;
  projectStatus: string;
  contractType: string;
  months: ResourceAllocationMonth[];
  totalEffortHours: number;
}

export interface HistoricalActivityRow {
  monthKey: string;
  projectId: string;
  projectName: string;
  workCategory: string;
  actualEffortHours: number;
}

export interface ResourceReconciliationIssue {
  monthKey: string;
  source: "FAMSTACK" | "PROJECT_TRACK";
  normalizedUtilization: number;
  sourceUtilization: number;
}

export interface ResourceDetailViewModel {
  employee: ResourceEmployeeDetail;

  currentSnapshot: ResourceMonthlyRecord | null;

  timeline: ResourceMonthlyRecord[];

  outlook: ResourceMonthlyRecord[];

  futureAllocations: ResourceProjectAllocation[];

  historicalActivity: HistoricalActivityRow[];

  reconciliationIssues: ResourceReconciliationIssue[];
}

export interface ResourceStatusPresentation {
  label: string;
  variant: "neutral" | "blue" | "green" | "amber" | "red";
}

export const RESOURCE_STATUS_PRESENTATION: Record<
  AvailabilityStatus,
  ResourceStatusPresentation
> = {
  AVAILABLE: {
    label: "Available",
    variant: "green",
  },

  PARTIALLY_AVAILABLE: {
    label: "Partially Available",
    variant: "blue",
  },

  FULLY_ALLOCATED: {
    label: "Fully Allocated",
    variant: "amber",
  },

  OVER_ALLOCATED: {
    label: "Over Allocated",
    variant: "red",
  },
};
