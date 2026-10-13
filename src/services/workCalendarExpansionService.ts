import type { CapacityConfigRecord } from "../types/capacity";

import type { Employee } from "../types/domain";

import type { FamstackRecord } from "../types/famstack";
import type { ProjectTrackRecord } from "../types/projectTrack";

import {
  DEFAULT_HOURS_PER_DAY,
  DEFAULT_WORKING_DAYS_PER_MONTH,
  UNSPECIFIED_GEO_LABEL,
} from "../constants/capacityFallback";

function calendarKey(
  country: string,
  location: string,
  monthKey: string,
): string {
  return `${country}::${location}::${monthKey}`;
}

function normalizeGeo(value: string): string {
  const trimmed = value.trim();

  return trimmed === "" ? UNSPECIFIED_GEO_LABEL : trimmed;
}

function collectMonthKeys(
  famstack: FamstackRecord[],
  projectTrack: ProjectTrackRecord[],
): string[] {
  const months = new Set<string>();

  for (const record of famstack) {
    if (record.month_key.trim() !== "") {
      months.add(record.month_key);
    }
  }

  for (const record of projectTrack) {
    if (record.month_key.trim() !== "") {
      months.add(record.month_key);
    }
  }

  return [...months].sort();
}

function averageWorkingDays(
  records: CapacityConfigRecord[],
  monthKey: string,
  country?: string,
): { workingDays: number; hoursPerDay: number } | null {
  const filtered = records.filter((record) => {
    if (record.month_key !== monthKey) {
      return false;
    }

    if (country !== undefined && record.country !== country) {
      return false;
    }

    return true;
  });

  if (filtered.length === 0) {
    return null;
  }

  const workingDays =
    filtered.reduce((sum, record) => sum + record.working_days, 0) /
    filtered.length;

  const hoursPerDay =
    filtered.reduce((sum, record) => sum + record.hours_per_day, 0) /
    filtered.length;

  return {
    workingDays: Math.round(workingDays),
    hoursPerDay: Math.round(hoursPerDay * 10) / 10,
  };
}

function estimateCapacity(
  baseConfig: CapacityConfigRecord[],
  country: string,
  location: string,
  monthKey: string,
): CapacityConfigRecord {
  const sameGeoMonth = averageWorkingDays(
    baseConfig,
    monthKey,
    country,
  );

  if (sameGeoMonth !== null) {
    return {
      country,
      location,
      month_key: monthKey,
      working_days: sameGeoMonth.workingDays,
      hours_per_day: sameGeoMonth.hoursPerDay,
      standard_capacity_hours:
        sameGeoMonth.workingDays * sameGeoMonth.hoursPerDay,
    };
  }

  const anyMonth = averageWorkingDays(baseConfig, monthKey);

  if (anyMonth !== null) {
    return {
      country,
      location,
      month_key: monthKey,
      working_days: anyMonth.workingDays,
      hours_per_day: anyMonth.hoursPerDay,
      standard_capacity_hours: anyMonth.workingDays * anyMonth.hoursPerDay,
    };
  }

  return {
    country,
    location,
    month_key: monthKey,
    working_days: DEFAULT_WORKING_DAYS_PER_MONTH,
    hours_per_day: DEFAULT_HOURS_PER_DAY,
    standard_capacity_hours:
      DEFAULT_WORKING_DAYS_PER_MONTH * DEFAULT_HOURS_PER_DAY,
  };
}

export interface WorkCalendarExpansionResult {
  records: CapacityConfigRecord[];
  addedEntries: number;
  warnings: string[];
}

export function expandCapacityConfigForOrganizationData({
  baseConfig,
  employees,
  famstack,
  projectTrack,
}: {
  baseConfig: CapacityConfigRecord[];
  employees: Employee[];
  famstack: FamstackRecord[];
  projectTrack: ProjectTrackRecord[];
}): WorkCalendarExpansionResult {
  const warnings: string[] = [];
  const existing = new Set(
    baseConfig.map((record) =>
      calendarKey(record.country, record.location, record.month_key),
    ),
  );

  const monthKeys = collectMonthKeys(famstack, projectTrack);

  if (monthKeys.length === 0) {
    return { records: baseConfig, addedEntries: 0, warnings };
  }

  const geoCombos = new Map<string, { country: string; location: string }>();

  for (const employee of employees) {
    const country = normalizeGeo(employee.country);
    const location = normalizeGeo(employee.location);
    const key = `${country}::${location}`;

    geoCombos.set(key, { country, location });
  }

  if (geoCombos.size === 0) {
    geoCombos.set(
      `${UNSPECIFIED_GEO_LABEL}::${UNSPECIFIED_GEO_LABEL}`,
      {
        country: UNSPECIFIED_GEO_LABEL,
        location: UNSPECIFIED_GEO_LABEL,
      },
    );
  }

  const additions: CapacityConfigRecord[] = [];

  for (const { country, location } of geoCombos.values()) {
    for (const monthKey of monthKeys) {
      const key = calendarKey(country, location, monthKey);

      if (existing.has(key)) {
        continue;
      }

      additions.push(estimateCapacity(baseConfig, country, location, monthKey));
      existing.add(key);
    }
  }

  if (additions.length > 0) {
    warnings.push(
      `Estimated capacity for ${additions.length} missing country/location/month combinations (for example ${additions[0].country}, ${additions[0].location}, ${additions[0].month_key}).`,
    );
  }

  return {
    records: [...baseConfig, ...additions],
    addedEntries: additions.length,
    warnings,
  };
}
