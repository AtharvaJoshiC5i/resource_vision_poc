import { mockResourceVisionBundle } from "./mockResourceVisionBundle";

/**
 * Static mock exports for dev validations and legacy imports.
 * Runtime pages should use `useResourceData()` from ResourceDataContext.
 */
export const capacityConfig = mockResourceVisionBundle.capacityConfig;
export const famstack = mockResourceVisionBundle.famstack;
export const projectTrack = mockResourceVisionBundle.projectTrack;
export const zinghr = mockResourceVisionBundle.zinghr;
export const employees = mockResourceVisionBundle.employees;
export const projects = mockResourceVisionBundle.projects;
export const plannedAllocations = mockResourceVisionBundle.plannedAllocations;
export const historicalAllocations =
  mockResourceVisionBundle.historicalAllocations;
export const historicalActivity = mockResourceVisionBundle.historicalActivity;
export const workCalendar = mockResourceVisionBundle.workCalendar;
export const availabilityQueryContext =
  mockResourceVisionBundle.availabilityQueryContext;
export const employeeMonthAvailability =
  mockResourceVisionBundle.employeeMonthAvailability;
export const resourceMonthlyRecords =
  mockResourceVisionBundle.resourceMonthlyRecords;
export const unassignedDemand = mockResourceVisionBundle.unassignedDemand;
