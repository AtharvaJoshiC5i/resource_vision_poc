import type { AvailabilityStatus } from "./domain";

export type ResourceDimension =
  | "primaryCapability"
  | "secondaryCapability"
  | "department"
  | "grade"
  | "location"
  | "country";

export type ResourceAvailabilityStatusFilter =
  | "WITH_CAPACITY"
  | AvailabilityStatus;

export interface ResourceFilters {
  search: string;

  primaryCapability: string[];
  secondaryCapability: string[];
  department: string[];
  grade: string[];
  location: string[];
  country: string[];

  availabilityStatus: ResourceAvailabilityStatusFilter[];

  focusMonth: string;
}

export interface ResourceFilterOption {
  value: string;
  label: string;
  count: number;
}

export interface ResourceFilterOptions {
  primaryCapability: ResourceFilterOption[];

  secondaryCapability: ResourceFilterOption[];

  department: ResourceFilterOption[];

  grade: ResourceFilterOption[];

  location: ResourceFilterOption[];

  country: ResourceFilterOption[];
}

export interface AvailabilityDimensionAggregate {
  key: string;

  totalResources: number;

  resourcesWithCapacity: number;

  fullyAvailableResources: number;

  partiallyAvailableResources: number;

  fullyAllocatedResources: number;

  overAllocatedResources: number;

  totalCapacityHours: number;

  allocatedHours: number;

  availableHours: number;
}

export interface AvailabilityDimensionMonthAggregate {
  key: string;

  months: {
    monthKey: string;

    totalResources: number;

    resourcesWithCapacity: number;

    availableHours: number;
  }[];
}
