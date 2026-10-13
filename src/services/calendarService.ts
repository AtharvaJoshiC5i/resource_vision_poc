import type { Employee, WorkforceState, WorkCalendar } from "../types/domain";

import {
  DEFAULT_HOURS_PER_DAY,
  DEFAULT_WORKING_DAYS_PER_MONTH,
  UNSPECIFIED_GEO_LABEL,
} from "../constants/capacityFallback";

import { parseMonthKey } from "./monthService";

function tryParseIsoDate(value: string): number | null {
  const trimmed = value.trim();

  if (trimmed === "") {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);

  if (match === null) {
    return null;
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
    return null;
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

  /*
   * Derived organization employees may not have a join date.
   * An empty join date is treated as "unknown" and does not
   * exclude the employee from the planning horizon.
   */
  const joiningDate = tryParseIsoDate(employee.dateOfJoining);

  if (joiningDate !== null && joiningDate > end) {
    return "NOT_JOINED";
  }

  if (employee.lastWorkingDate !== undefined) {
    const leavingDate = tryParseIsoDate(employee.lastWorkingDate);

    if (leavingDate !== null && leavingDate < start) {
      return "EXITED";
    }
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
      continue;
    }

    lookup.set(key, record);
  }

  return lookup;
}

function normalizeGeoLabel(value: string): string {
  const trimmed = value.trim();

  return trimmed === "" ? UNSPECIFIED_GEO_LABEL : trimmed;
}

function createFallbackWorkCalendar(
  country: string,
  location: string,
  monthKey: string,
): WorkCalendar {
  const workingDays = DEFAULT_WORKING_DAYS_PER_MONTH;
  const hoursPerDay = DEFAULT_HOURS_PER_DAY;

  return {
    country,
    location,
    monthKey,
    workingDays,
    hoursPerDay,
    monthlyCapacity: workingDays * hoursPerDay,
  };
}

export interface ResolvedWorkCalendar {
  calendar: WorkCalendar;
  usedFallback: boolean;
}

export function resolveWorkCalendar(
  lookup: Map<string, WorkCalendar>,
  country: string,
  location: string,
  monthKey: string,
): ResolvedWorkCalendar {
  const normalizedCountry = normalizeGeoLabel(country);
  const normalizedLocation = normalizeGeoLabel(location);

  const exact = lookup.get(
    createCalendarKey(normalizedCountry, normalizedLocation, monthKey),
  );

  if (exact !== undefined) {
    return { calendar: exact, usedFallback: false };
  }

  const sameCountryMonth = [...lookup.values()].find(
    (entry) =>
      entry.country === normalizedCountry && entry.monthKey === monthKey,
  );

  if (sameCountryMonth !== undefined) {
    return {
      calendar: {
        ...sameCountryMonth,
        country: normalizedCountry,
        location: normalizedLocation,
      },
      usedFallback: true,
    };
  }

  const sameMonth = [...lookup.values()].find(
    (entry) => entry.monthKey === monthKey,
  );

  if (sameMonth !== undefined) {
    return {
      calendar: {
        ...sameMonth,
        country: normalizedCountry,
        location: normalizedLocation,
      },
      usedFallback: true,
    };
  }

  return {
    calendar: createFallbackWorkCalendar(
      normalizedCountry,
      normalizedLocation,
      monthKey,
    ),
    usedFallback: true,
  };
}

export function getWorkCalendar(
  lookup: Map<string, WorkCalendar>,
  country: string,
  location: string,
  monthKey: string,
): WorkCalendar {
  return resolveWorkCalendar(lookup, country, location, monthKey).calendar;
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
