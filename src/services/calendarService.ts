import type { Employee, WorkforceState, WorkCalendar } from "../types/domain";

import { parseMonthKey } from "./monthService";

function parseIsoDate(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());

  if (match === null) {
    throw new Error(`Invalid employee date: ${value}`);
  }

  const year = Number(match[1]);

  const month = Number(match[2]);

  const day = Number(match[3]);

  const timestamp = Date.UTC(year, month - 1, day);

  const date = new Date(timestamp);

  const valid =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  if (!valid) {
    throw new Error(`Invalid employee date: ${value}`);
  }

  return timestamp;
}

function getMonthBounds(monthKey: string): {
  start: number;
  end: number;
} {
  const { year, month } = parseMonthKey(monthKey);

  return {
    start: Date.UTC(year, month - 1, 1),

    end: Date.UTC(year, month, 0, 23, 59, 59, 999),
  };
}

export function getWorkforceState(
  employee: Employee,
  monthKey: string,
): WorkforceState {
  const { start, end } = getMonthBounds(monthKey);

  const joiningDate = parseIsoDate(employee.dateOfJoining);

  if (joiningDate > end) {
    return "NOT_JOINED";
  }

  if (
    employee.lastWorkingDate !== undefined &&
    employee.lastWorkingDate.trim() !== "" &&
    parseIsoDate(employee.lastWorkingDate) < start
  ) {
    return "EXITED";
  }

  return "ACTIVE";
}

export function isEmployeeActiveInMonth(
  employee: Employee,
  monthKey: string,
): boolean {
  return getWorkforceState(employee, monthKey) === "ACTIVE";
}

function createCalendarKey(
  country: string,
  location: string,
  monthKey: string,
): string {
  return `${country}::${location}::${monthKey}`;
}

export function buildWorkCalendarLookup(
  records: WorkCalendar[],
): Map<string, WorkCalendar> {
  const lookup = new Map<string, WorkCalendar>();

  for (const record of records) {
    const key = createCalendarKey(
      record.country,
      record.location,
      record.monthKey,
    );

    if (lookup.has(key)) {
      throw new Error(`Duplicate work calendar entry: ${key}`);
    }

    lookup.set(key, record);
  }

  return lookup;
}

export function getWorkCalendar(
  lookup: Map<string, WorkCalendar>,

  country: string,

  location: string,

  monthKey: string,
): WorkCalendar {
  const key = createCalendarKey(country, location, monthKey);

  const calendar = lookup.get(key);

  if (calendar === undefined) {
    throw new Error(
      `Missing work calendar for ${country}, ${location}, ${monthKey}.`,
    );
  }

  return calendar;
}

export function calculateEmployeeCapacity(
  employee: Employee,
  workCalendar: WorkCalendar,
): number {
  if (workCalendar.workingDays < 0 || workCalendar.hoursPerDay < 0) {
    throw new Error(
      `Work calendar cannot contain negative working days or hours per day for ${workCalendar.location}, ${workCalendar.monthKey}.`,
    );
  }

  if (employee.ftePercentage < 0) {
    throw new Error(
      `Employee ${employee.employeeId} has invalid negative FTE percentage ${employee.ftePercentage}.`,
    );
  }

  const baseCapacity = workCalendar.workingDays * workCalendar.hoursPerDay;

  return baseCapacity * employee.ftePercentage;
}
