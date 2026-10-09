import type { AvailabilityStatus } from "./resourceMonthly";

export interface ResourceOutlookMonth {
  monthKey: string;
  availabilityPercentage: number;
  availableCapacity: number;
  status: AvailabilityStatus;
}

export interface ResourceTableRow {
  employeeId: string;
  employeeName: string;

  primaryCapability: string;
  secondaryCapability: string;
  department: string;
  grade: string;
  location: string;
  country: string;

  totalCapacity: number;
  utilizedCapacity: number;
  availableCapacity: number;
  availabilityPercentage: number;
  availabilityStatus: AvailabilityStatus;

  outlook: Partial<Record<string, ResourceOutlookMonth>>;
}

export interface ResourceFilters {
  month: string;

  primaryCapability?: string;
  secondaryCapability?: string;
  department?: string;
  grade?: string;
  country?: string;
  location?: string;
  status?: AvailabilityStatus;
}

export interface ResourceFilterOptions {
  primaryCapabilities: string[];
  secondaryCapabilities: string[];
  departments: string[];
  grades: string[];
  countries: string[];
  locations: string[];
}

export interface ResourceSummaryData {
  resourceCount: number;
  availableResourceCount: number;

  totalCapacity: number;
  utilizedCapacity: number;
  availableCapacity: number;

  availabilityPercentage: number;

  overAllocatedCount: number;
}

export type ResourceSortField =
  | "employeeName"
  | "availableCapacity"
  | "availabilityPercentage"
  | "utilizedCapacity";

export type ResourceSortDirection = "asc" | "desc";

export interface ResourceSort {
  field: ResourceSortField;
  direction: ResourceSortDirection;
}
