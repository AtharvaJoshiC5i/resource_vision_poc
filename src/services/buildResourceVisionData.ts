import type { CapacityConfigRecord } from "../types/capacity";
import type { Employee } from "../types/domain";
import type { FamstackRecord } from "../types/famstack";
import type { ProjectTrackRecord } from "../types/projectTrack";
import type { ResourceMonthlyRecord } from "../types/resourceMonthly";
import type { UnassignedDemandRecord } from "../types/demand";
import type { ZingHREmployee } from "../types/zinghr";

import {
  buildEmployeeMonthAvailabilities,
  buildResourceMonthlyRecords,
} from "./resourceNormalizationService";

import { normalizeEmployees } from "./normalization/employeeNormalizationService";

import {
  normalizeProjects,
  normalizeProjectTrackAllocations,
} from "./normalization/projectTrackNormalizationService";

import {
  normalizeHistoricalActivity,
  normalizeHistoricalAllocations,
} from "./normalization/famstackNormalizationService";

import { normalizeWorkCalendar } from "./normalization/workCalendarNormalizationService";

import { getUnassignedDemand } from "./demandService";

export interface AvailabilityQueryContext {
  employees: Employee[];
  projects: ReturnType<typeof normalizeProjects>;
  historicalAllocations: ReturnType<typeof normalizeHistoricalAllocations>;
  plannedAllocations: ReturnType<typeof normalizeProjectTrackAllocations>;
  workCalendar: ReturnType<typeof normalizeWorkCalendar>;
}

export interface ResourceVisionSourceInput {
  capacityConfig: CapacityConfigRecord[];
  famstack: FamstackRecord[];
  projectTrack: ProjectTrackRecord[];
  zinghr: ZingHREmployee[];
}

export interface ResourceVisionDataBundle extends ResourceVisionSourceInput {
  employees: Employee[];
  projects: ReturnType<typeof normalizeProjects>;
  plannedAllocations: ReturnType<typeof normalizeProjectTrackAllocations>;
  historicalAllocations: ReturnType<typeof normalizeHistoricalAllocations>;
  historicalActivity: ReturnType<typeof normalizeHistoricalActivity>;
  workCalendar: ReturnType<typeof normalizeWorkCalendar>;
  availabilityQueryContext: AvailabilityQueryContext;
  employeeMonthAvailability: ReturnType<typeof buildEmployeeMonthAvailabilities>;
  resourceMonthlyRecords: ResourceMonthlyRecord[];
  unassignedDemand: UnassignedDemandRecord[];
}

export function buildResourceVisionData(
  input: ResourceVisionSourceInput,
): ResourceVisionDataBundle {
  const employees = normalizeEmployees(input.zinghr);
  const projects = normalizeProjects(input.projectTrack);
  const plannedAllocations = normalizeProjectTrackAllocations(
    input.projectTrack,
  );
  const historicalAllocations = normalizeHistoricalAllocations(input.famstack);
  const historicalActivity = normalizeHistoricalActivity(input.famstack);
  const workCalendar = normalizeWorkCalendar(input.capacityConfig);

  const availabilityQueryContext: AvailabilityQueryContext = {
    employees,
    projects,
    historicalAllocations,
    plannedAllocations,
    workCalendar,
  };

  const normalizationInput = {
    employees: input.zinghr,
    famstackRecords: input.famstack,
    projectTrackRecords: input.projectTrack,
    capacityConfig: input.capacityConfig,
  };

  return {
    ...input,
    employees,
    projects,
    plannedAllocations,
    historicalAllocations,
    historicalActivity,
    workCalendar,
    availabilityQueryContext,
    employeeMonthAvailability: buildEmployeeMonthAvailabilities(
      normalizationInput,
    ),
    resourceMonthlyRecords: buildResourceMonthlyRecords(normalizationInput),
    unassignedDemand: getUnassignedDemand(input.projectTrack),
  };
}
