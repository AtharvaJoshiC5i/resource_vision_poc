import type { CapacityConfigRecord } from "../types/capacity";

function createCapacityKey(
  country: string,
  location: string,
  monthKey: string,
): string {
  return `${country}::${location}::${monthKey}`;
}

export function buildCapacityLookup(
  capacityConfig: CapacityConfigRecord[],
): Map<string, number> {
  const lookup = new Map<string, number>();

  for (const record of capacityConfig) {
    const key = createCapacityKey(
      record.country,
      record.location,
      record.month_key,
    );

    if (lookup.has(key)) {
      throw new Error(
        `Duplicate capacity configuration for country=${record.country}, location=${record.location}, month=${record.month_key}.`,
      );
    }

    lookup.set(key, record.standard_capacity_hours);
  }

  return lookup;
}

export function getMonthlyCapacity(
  lookup: Map<string, number>,
  country: string,
  location: string,
  monthKey: string,
): number {
  const key = createCapacityKey(country, location, monthKey);

  const capacity = lookup.get(key);

  if (capacity === undefined) {
    throw new Error(
      `Missing capacity configuration for country=${country}, location=${location}, month=${monthKey}.`,
    );
  }

  if (!Number.isFinite(capacity)) {
    throw new Error(
      `Invalid capacity for country=${country}, location=${location}, month=${monthKey}: ${capacity}.`,
    );
  }

  if (capacity < 0) {
    throw new Error(
      `Negative capacity for country=${country}, location=${location}, month=${monthKey}: ${capacity}.`,
    );
  }

  return capacity;
}
