import type {
  AvailabilityStatus,
} from "./domain";

export type AvailabilityAttentionType =
  | "CAPACITY_REDUCTION"
  | "BECOMING_FULLY_ALLOCATED"
  | "BECOMING_OVER_ALLOCATED"
  | "OVER_ALLOCATED";

export interface AvailabilityAttentionItem {
  employeeId: string;
  employeeName: string;

  primaryCapability: string;
  grade: string;

  monthKey: string;

  type:
    AvailabilityAttentionType;

  previousAvailableHours?: number;
  currentAvailableHours: number;

  changeHours?: number;

  status:
    AvailabilityStatus;

  overAllocatedHours: number;
}

export interface UpcomingAvailabilityMonthSummary {
  monthKey: string;

  resourcesGainingCapacity: number;

  additionalAvailableHours: number;

  resourcesBecomingFullyAvailable: number;
}