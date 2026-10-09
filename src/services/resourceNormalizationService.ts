import type { CapacityConfigRecord } from "../types/capacity";

import type { EmployeeMonthAvailability } from "../types/domain";

import type { FamstackRecord } from "../types/famstack";

import type { ProjectTrackRecord } from "../types/projectTrack";

import type { ResourceMonthlyRecord } from "../types/resourceMonthly";

import type { ZingHREmployee } from "../types/zinghr";

import { FAMSTACK_MONTHS, PROJECT_TRACK_MONTHS } from "../constants/poc";

import { normalizeEmployees } from "./normalization/employeeNormalizationService";

import { normalizeHistoricalAllocations } from "./normalization/famstackNormalizationService";

import {
  normalizeProjects,
  normalizeProjectTrackAllocations,
} from "./normalization/projectTrackNormalizationService";

import { normalizeWorkCalendar } from "./normalization/workCalendarNormalizationService";

import { getAvailabilityForRange } from "./availabilityQueryService";

/*
 * Complete synthetic data horizon used by the
 * normalization pipeline.
 *
 * Historical actuals:
 * Jan 2026 -> Aug 2026
 *
 * Future planning data:
 * Sep 2026 -> Mar 2027
 *
 * The month sequence is intentionally derived from
 * the centralized POC constants rather than being
 * hard-coded to a specific year.
 */
const POC_MONTHS = [...FAMSTACK_MONTHS, ...PROJECT_TRACK_MONTHS];

export interface BuildResourceMonthlyRecordsInput {
  employees: ZingHREmployee[];

  famstackRecords: FamstackRecord[];

  projectTrackRecords: ProjectTrackRecord[];

  capacityConfig: CapacityConfigRecord[];
}

export function buildEmployeeMonthAvailabilities({
  employees,
  famstackRecords,
  projectTrackRecords,
  capacityConfig,
}: BuildResourceMonthlyRecordsInput): EmployeeMonthAvailability[] {
  /*
   * Normalize each source into the canonical domain
   * models first.
   *
   * Raw source records must never be used directly
   * by the availability UI.
   */
  const normalizedEmployees = normalizeEmployees(employees);

  const projects = normalizeProjects(projectTrackRecords);

  const historicalAllocations = normalizeHistoricalAllocations(famstackRecords);

  const plannedAllocations =
    normalizeProjectTrackAllocations(projectTrackRecords);

  const workCalendar = normalizeWorkCalendar(capacityConfig);

  /*
   * The Availability Engine remains the single
   * authority for monthly availability.
   *
   * No availability values are precomputed here.
   *
   * The engine receives:
   *
   * Employee
   * + Allocation
   * + Work Calendar
   *
   * and calculates availability for the complete
   * synthetic horizon, including the
   * Dec 2026 -> Jan 2027 year boundary.
   */
  return getAvailabilityForRange(
    {
      employees: normalizedEmployees,

      projects,

      historicalAllocations,

      plannedAllocations,

      workCalendar,
    },

    POC_MONTHS[0],

    POC_MONTHS.length,
  );
}

/*
 * Compatibility adapter for the existing
 * Availability V1 / legacy UI surfaces.
 *
 * EmployeeMonthAvailability remains the canonical
 * domain model underneath this view model.
 *
 * No calculations are performed here.
 */
export function buildResourceMonthlyRecords(
  input: BuildResourceMonthlyRecordsInput,
): ResourceMonthlyRecord[] {
  return buildEmployeeMonthAvailabilities(input).map((availability) => ({
    employee_id: availability.employeeId,

    employee_name: availability.employeeName,

    primary_capability: availability.primaryCapability,

    secondary_capability: availability.secondaryCapability,

    department: availability.department,

    grade: availability.grade,

    location: availability.location,

    country: availability.country,

    month_key: availability.monthKey,

    total_capacity: availability.totalCapacityHours,

    utilized_capacity: availability.allocatedHours,

    available_capacity: availability.availableHours,

    utilization_percentage: availability.utilizationPercentage,

    availability_percentage: availability.availabilityPercentage,

    availability_status: availability.status,

    source: availability.source,
  }));
}
