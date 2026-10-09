import type {
  Allocation,
  AvailabilityStatus,
  Employee,
  EmployeeMonthAvailability,
  Project,
  WorkCalendar,
} from "../types/domain";

import {
  getAllocatedHours,
  getEmployeeMonthAllocations,
  getProjectAllocationBreakdown,
} from "./allocationService";

import {
  calculateEmployeeCapacity,
  getWorkforceState,
} from "./calendarService";

import { getSourceForMonth } from "./sourcePeriodService";

export function getAvailabilityStatus(
  allocatedHours: number,
  availableHours: number,
): AvailabilityStatus {
  if (availableHours < 0) {
    return "OVER_ALLOCATED";
  }

  if (availableHours === 0) {
    return "FULLY_ALLOCATED";
  }

  if (allocatedHours === 0 && availableHours > 0) {
    return "AVAILABLE";
  }

  return "PARTIALLY_AVAILABLE";
}

export interface CalculateEmployeeMonthAvailabilityInput {
  employee: Employee;

  monthKey: string;

  workCalendar: WorkCalendar;

  allocations: Allocation[];

  projects: Project[];

  /**
   * Blocking is deliberately not implemented yet.
   *
   * Phase 2 callers normally omit this value.
   */
  blockedHours?: number;
}

export function calculateEmployeeMonthAvailability({
  employee,
  monthKey,
  workCalendar,
  allocations,
  projects,
  blockedHours: inputBlockedHours,
}: CalculateEmployeeMonthAvailabilityInput): EmployeeMonthAvailability {
  const workforceState = getWorkforceState(employee, monthKey);

  if (workforceState !== "ACTIVE") {
    throw new Error(
      `Cannot calculate normal availability for employee ${employee.employeeId}, month ${monthKey}: workforce state is ${workforceState}.`,
    );
  }

  const blockedHours = inputBlockedHours ?? 0;

  if (!Number.isFinite(blockedHours) || blockedHours < 0) {
    throw new Error(
      `Invalid blocked hours for employee ${employee.employeeId}, month ${monthKey}: ${blockedHours}.`,
    );
  }

  const employeeAllocations = getEmployeeMonthAllocations(
    allocations,
    employee.employeeId,
    monthKey,
  );

  const allocatedHours = getAllocatedHours(employeeAllocations);

  const totalCapacityHours = calculateEmployeeCapacity(employee, workCalendar);

  const availableHours = totalCapacityHours - allocatedHours;

  const availableToPromiseHours =
    totalCapacityHours - allocatedHours - blockedHours;

  /*
   * Domain values retain calculation precision.
   *
   * UI formatting should decide whether to show
   * 31.8%, 31.82%, etc.
   */
  const availabilityPercentage =
    totalCapacityHours === 0 ? 0 : (availableHours / totalCapacityHours) * 100;

  const utilizationPercentage =
    totalCapacityHours === 0 ? 0 : (allocatedHours / totalCapacityHours) * 100;

  return {
    employeeId: employee.employeeId,

    employeeName: employee.employeeName,

    monthKey,

    workforceState,

    totalCapacityHours,

    allocatedHours,

    blockedHours,

    availableHours,

    availableToPromiseHours,

    availabilityPercentage,

    utilizationPercentage,

    status: getAvailabilityStatus(allocatedHours, availableHours),

    source: employeeAllocations[0]?.source ?? getSourceForMonth(monthKey),

    projectAllocations: getProjectAllocationBreakdown(
      employeeAllocations,
      projects,
    ),

    primaryCapability: employee.primaryCapability,

    secondaryCapability: employee.secondaryCapability,

    department: employee.department,

    grade: employee.grade,

    location: employee.location,

    country: employee.country,
  };
}
