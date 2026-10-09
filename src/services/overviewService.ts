import type { UnassignedDemandRecord } from "../types/demand";
import type { ResourceMonthlyRecord } from "../types/resourceMonthly";

import { FAMSTACK_MONTHS, PROJECT_TRACK_MONTHS } from "../constants/poc";

import { aggregateResourceRecords } from "./aggregationService";

export interface OverviewSnapshot {
  monthKey: string;

  totalCapacity: number;
  utilizedCapacity: number;
  availableCapacity: number;

  utilizationPercentage: number;
  availabilityPercentage: number;

  activeResourceCount: number;
  availableResourceCount: number;

  unassignedDemandHours: number;
  unassignedDemandCount: number;
}

export interface MonthlyAvailabilityTrendItem {
  monthKey: string;

  totalCapacity: number;
  utilizedCapacity: number;
  availableCapacity: number;

  availabilityPercentage: number;
  utilizationPercentage: number;

  source: "FAMSTACK" | "PROJECT_TRACK";
}

export interface CapabilityAvailabilityItem {
  primaryCapability: string;

  totalCapacity: number;
  utilizedCapacity: number;
  availableCapacity: number;

  availabilityPercentage: number;
  utilizationPercentage: number;

  resourceCount: number;
}

export interface CapacityOutlookRow {
  primaryCapability: string;

  months: Record<
    string,
    {
      totalCapacity: number;
      utilizedCapacity: number;
      availableCapacity: number;
      availabilityPercentage: number;
    }
  >;
}

/*
 * Complete historical + planning month list.
 *
 * These are derived from the centralized POC constants
 * so this legacy overview service stays aligned with
 * the same planning horizon used by the rest of the app.
 */
export const POC_MONTH_OPTIONS = [
  ...FAMSTACK_MONTHS,
  ...PROJECT_TRACK_MONTHS,
] as const;

/*
 * Forward planning months.
 *
 * This now includes:
 *
 * Sep 2026
 * Oct 2026
 * Nov 2026
 * Dec 2026
 * Jan 2027
 * Feb 2027
 * Mar 2027
 */
export const PLANNING_MONTHS = [...PROJECT_TRACK_MONTHS] as const;

function getMonthRecords(
  records: ResourceMonthlyRecord[],
  monthKey: string,
): ResourceMonthlyRecord[] {
  return records.filter((record) => record.month_key === monthKey);
}

function getSourceForMonth(monthKey: string): "FAMSTACK" | "PROJECT_TRACK" {
  return PROJECT_TRACK_MONTHS.includes(
    monthKey as (typeof PROJECT_TRACK_MONTHS)[number],
  )
    ? "PROJECT_TRACK"
    : "FAMSTACK";
}

export function getOverviewSnapshot(
  records: ResourceMonthlyRecord[],
  demandRecords: UnassignedDemandRecord[],
  monthKey: string,
): OverviewSnapshot {
  const monthRecords = getMonthRecords(records, monthKey);

  const aggregate = aggregateResourceRecords(monthRecords);

  const monthlyDemand = getMonthlyUnassignedDemand(demandRecords, monthKey);

  const unassignedDemandHours = monthlyDemand.reduce(
    (total, demand) => total + demand.effort_hours,
    0,
  );

  return {
    monthKey,

    totalCapacity: aggregate.totalCapacity,

    utilizedCapacity: aggregate.utilizedCapacity,

    availableCapacity: aggregate.availableCapacity,

    utilizationPercentage: aggregate.utilizationPercentage,

    availabilityPercentage: aggregate.availabilityPercentage,

    activeResourceCount: monthRecords.length,

    availableResourceCount: monthRecords.filter(
      (record) => record.available_capacity > 0,
    ).length,

    unassignedDemandHours,

    unassignedDemandCount: monthlyDemand.length,
  };
}

export function getMonthlyAvailabilityTrend(
  records: ResourceMonthlyRecord[],
): MonthlyAvailabilityTrendItem[] {
  return POC_MONTH_OPTIONS.map((monthKey) => {
    const monthRecords = getMonthRecords(records, monthKey);

    const aggregate = aggregateResourceRecords(monthRecords);

    return {
      monthKey,

      totalCapacity: aggregate.totalCapacity,

      utilizedCapacity: aggregate.utilizedCapacity,

      availableCapacity: aggregate.availableCapacity,

      availabilityPercentage: aggregate.availabilityPercentage,

      utilizationPercentage: aggregate.utilizationPercentage,

      source: getSourceForMonth(monthKey),
    };
  });
}

export function getCapabilityAvailability(
  records: ResourceMonthlyRecord[],
  monthKey: string,
): CapabilityAvailabilityItem[] {
  const monthRecords = getMonthRecords(records, monthKey);

  const groups = new Map<string, ResourceMonthlyRecord[]>();

  for (const record of monthRecords) {
    const existing = groups.get(record.primary_capability) ?? [];

    existing.push(record);

    groups.set(record.primary_capability, existing);
  }

  return [...groups.entries()]
    .map(([primaryCapability, capabilityRecords]) => {
      const aggregate = aggregateResourceRecords(capabilityRecords);

      return {
        primaryCapability,

        totalCapacity: aggregate.totalCapacity,

        utilizedCapacity: aggregate.utilizedCapacity,

        availableCapacity: aggregate.availableCapacity,

        availabilityPercentage: aggregate.availabilityPercentage,

        utilizationPercentage: aggregate.utilizationPercentage,

        resourceCount: capabilityRecords.length,
      };
    })
    .sort(
      (left, right) =>
        left.availabilityPercentage - right.availabilityPercentage,
    );
}

export function getCapacityOutlook(
  records: ResourceMonthlyRecord[],
): CapacityOutlookRow[] {
  const capabilityNames = [
    ...new Set(records.map((record) => record.primary_capability)),
  ].sort((left, right) => left.localeCompare(right));

  return capabilityNames.map((primaryCapability) => {
    const months: CapacityOutlookRow["months"] = {};

    for (const monthKey of PLANNING_MONTHS) {
      const monthRecords = records.filter(
        (record) =>
          record.month_key === monthKey &&
          record.primary_capability === primaryCapability,
      );

      const aggregate = aggregateResourceRecords(monthRecords);

      months[monthKey] = {
        totalCapacity: aggregate.totalCapacity,

        utilizedCapacity: aggregate.utilizedCapacity,

        availableCapacity: aggregate.availableCapacity,

        availabilityPercentage: aggregate.availabilityPercentage,
      };
    }

    return {
      primaryCapability,
      months,
    };
  });
}

export function getMonthlyUnassignedDemand(
  demandRecords: UnassignedDemandRecord[],
  monthKey: string,
): UnassignedDemandRecord[] {
  return demandRecords.filter((record) => record.month_key === monthKey);
}
