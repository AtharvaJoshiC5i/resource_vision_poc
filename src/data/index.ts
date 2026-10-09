import capacityConfigData from "./capacityConfig.json";
import famstackData from "./famstack.json";
import projectTrackData from "./projectTrack.json";
import zinghrData from "./zinghr.json";

import type { CapacityConfigRecord } from "../types/capacity";

import type { FamstackRecord } from "../types/famstack";

import type { ProjectTrackRecord } from "../types/projectTrack";

import type { ZingHREmployee } from "../types/zinghr";

import {
  buildEmployeeMonthAvailabilities,
  buildResourceMonthlyRecords,
} from "../services/resourceNormalizationService";

import { normalizeEmployees } from "../services/normalization/employeeNormalizationService";

import {
  normalizeProjects,
  normalizeProjectTrackAllocations,
} from "../services/normalization/projectTrackNormalizationService";

import {
  normalizeHistoricalActivity,
  normalizeHistoricalAllocations,
} from "../services/normalization/famstackNormalizationService";

import { normalizeWorkCalendar } from "../services/normalization/workCalendarNormalizationService";

import { getUnassignedDemand } from "../services/demandService";

export const capacityConfig = capacityConfigData as CapacityConfigRecord[];

export const famstack = famstackData as FamstackRecord[];

export const projectTrack = projectTrackData as ProjectTrackRecord[];

export const zinghr = zinghrData as ZingHREmployee[];

/*
 * Canonical Resource Vision domain.
 */
export const employees = normalizeEmployees(zinghr);

export const projects = normalizeProjects(projectTrack);

export const plannedAllocations =
  normalizeProjectTrackAllocations(projectTrack);

export const historicalAllocations = normalizeHistoricalAllocations(famstack);

export const historicalActivity = normalizeHistoricalActivity(famstack);

export const workCalendar = normalizeWorkCalendar(capacityConfig);

export const availabilityQueryContext = {
  employees,

  projects,

  historicalAllocations,

  plannedAllocations,

  workCalendar,
};

/*
 * Current POC employee-month availability.
 *
 * The normalization/calculation pipeline derives
 * all available months from the supplied source
 * datasets and centralized planning constants.
 *
 * Therefore January-March 2027 are included
 * automatically once the extended source data
 * is present.
 */
export const employeeMonthAvailability = buildEmployeeMonthAvailabilities({
  employees: zinghr,

  famstackRecords: famstack,

  projectTrackRecords: projectTrack,

  capacityConfig,
});

/*
 * Existing UI compatibility model.
 */
export const resourceMonthlyRecords = buildResourceMonthlyRecords({
  employees: zinghr,

  famstackRecords: famstack,

  projectTrackRecords: projectTrack,

  capacityConfig,
});

export const unassignedDemand = getUnassignedDemand(projectTrack);
