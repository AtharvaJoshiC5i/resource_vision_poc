import type { UnassignedDemandRecord } from "./demand";
import type { ResourceMonthlyRecord } from "./resourceMonthly";

export type AvailabilityDimension =
  | "primary_capability"
  | "secondary_capability"
  | "department"
  | "grade"
  | "country"
  | "location"
  | "employee";

export type MatrixMetric =
  | "availabilityPercentage"
  | "availableCapacity"
  | "utilizedCapacity";

export interface AvailabilityFilters {
  month?: string;
  primaryCapability?: string;
  secondaryCapability?: string;
  department?: string;
  grade?: string;
  country?: string;
  location?: string;
}

export interface AvailabilityMatrixMetric {
  totalCapacity: number;
  utilizedCapacity: number;
  availableCapacity: number;
  availabilityPercentage: number;
  resourceCount: number;
}

export interface AvailabilityHierarchyPathItem {
  dimension: AvailabilityDimension;
  value: string;
}

export interface AvailabilityMatrixRow {
  id: string;
  label: string;
  dimension: AvailabilityDimension;
  depth: number;
  path: AvailabilityHierarchyPathItem[];
  expandable: boolean;
  employeeId?: string;
  records: ResourceMonthlyRecord[];
  monthlyMetrics: Record<string, AvailabilityMatrixMetric | undefined>;
  resourceCount: number;
}

export interface AvailabilitySummaryData {
  resourceCount: number;
  totalCapacity: number;
  utilizedCapacity: number;
  availableCapacity: number;
  availabilityPercentage: number;
}

export interface AvailabilityCellSelection {
  row: AvailabilityMatrixRow;
  monthKey: string;
}

export interface AvailabilityDetailData {
  title: string;
  monthKey: string;
  source: "FAMSTACK" | "PROJECT_TRACK";
  dimension: AvailabilityDimension;
  employeeId?: string;

  metrics: AvailabilityMatrixMetric;

  resources: ResourceMonthlyRecord[];

  unassignedDemand: UnassignedDemandRecord[];
  unassignedDemandHours: number;
}
