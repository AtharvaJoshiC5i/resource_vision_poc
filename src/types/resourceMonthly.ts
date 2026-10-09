import type { AvailabilityStatus as DomainAvailabilityStatus } from "./domain";

export type ResourceDataSource = "FAMSTACK" | "PROJECT_TRACK";

export type AvailabilityStatus = DomainAvailabilityStatus;

export interface ResourceMonthlyRecord {
  employee_id: string;
  employee_name: string;

  primary_capability: string;
  secondary_capability: string;

  department: string;
  grade: string;

  location: string;
  country: string;

  month_key: string;

  total_capacity: number;

  utilized_capacity: number;

  available_capacity: number;

  utilization_percentage: number;

  availability_percentage: number;

  availability_status: AvailabilityStatus;

  source: ResourceDataSource;
}

export interface ResourceRecordFilters {
  month?: string;

  primaryCapability?: string;

  secondaryCapability?: string;

  department?: string;

  grade?: string;

  country?: string;

  location?: string;

  employeeId?: string;
}

export interface ResourceAggregate {
  totalCapacity: number;

  utilizedCapacity: number;

  availableCapacity: number;

  availabilityPercentage: number;

  utilizationPercentage: number;
}
