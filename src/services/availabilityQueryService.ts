import type {
  Allocation,
  Employee,
  EmployeeMonthAvailability,
  Project,
  WorkCalendar,
} from "../types/domain";

import { calculateEmployeeMonthAvailability } from "./availabilityService";

import {
  buildWorkCalendarLookup,
  getWorkCalendar,
  getWorkforceState,
} from "./calendarService";

import { getMonthRange } from "./monthService";

import { getSourceForMonth } from "./sourcePeriodService";

export interface AvailabilityQueryContext {
  employees: Employee[];

  projects: Project[];

  historicalAllocations: Allocation[];

  plannedAllocations: Allocation[];

  workCalendar: WorkCalendar[];
}

function getAllocationsForMonth(
  context: AvailabilityQueryContext,

  monthKey: string,
): Allocation[] {
  const source = getSourceForMonth(monthKey);

  return source === "FAMSTACK"
    ? context.historicalAllocations
    : context.plannedAllocations;
}

export function getEmployeeAvailabilityForMonth(
  context: AvailabilityQueryContext,

  employeeId: string,
  monthKey: string,
): EmployeeMonthAvailability | null {
  const employee = context.employees.find(
    (candidate) => candidate.employeeId === employeeId,
  );

  if (employee === undefined) {
    throw new Error(`Unknown employee: ${employeeId}`);
  }

  const workforceState = getWorkforceState(employee, monthKey);

  if (workforceState !== "ACTIVE") {
    return null;
  }

  const calendarLookup = buildWorkCalendarLookup(context.workCalendar);

  const workCalendar = getWorkCalendar(
    calendarLookup,
    employee.country,
    employee.location,
    monthKey,
  );

  return calculateEmployeeMonthAvailability({
    employee,
    monthKey,
    workCalendar,

    allocations: getAllocationsForMonth(context, monthKey),

    projects: context.projects,
  });
}

export function getEmployeeAvailabilityRange(
  context: AvailabilityQueryContext,

  employeeId: string,
  startMonth: string,
  numberOfMonths: number,
): EmployeeMonthAvailability[] {
  return getMonthRange(startMonth, numberOfMonths)
    .map((monthKey) =>
      getEmployeeAvailabilityForMonth(context, employeeId, monthKey),
    )
    .filter((result): result is EmployeeMonthAvailability => result !== null);
}

export function getAvailabilityForMonth(
  context: AvailabilityQueryContext,

  monthKey: string,
): EmployeeMonthAvailability[] {
  const calendarLookup = buildWorkCalendarLookup(context.workCalendar);

  const allocations = getAllocationsForMonth(context, monthKey);

  const results: EmployeeMonthAvailability[] = [];

  for (const employee of context.employees) {
    if (getWorkforceState(employee, monthKey) !== "ACTIVE") {
      continue;
    }

    const workCalendar = getWorkCalendar(
      calendarLookup,
      employee.country,
      employee.location,
      monthKey,
    );

    results.push(
      calculateEmployeeMonthAvailability({
        employee,
        monthKey,
        workCalendar,
        allocations,
        projects: context.projects,
      }),
    );
  }

  return results;
}

export function getAvailabilityForRange(
  context: AvailabilityQueryContext,

  startMonth: string,
  numberOfMonths: number,
): EmployeeMonthAvailability[] {
  return getMonthRange(startMonth, numberOfMonths).flatMap((monthKey) =>
    getAvailabilityForMonth(context, monthKey),
  );
}
