import { useCallback, useMemo } from "react";

import { useSearchParams } from "react-router-dom";

import type {
  ResourceAvailabilityStatusFilter,
  ResourceDimension,
  ResourceFilters,
} from "../types/resourceFilters";

const ARRAY_KEYS = [
  "primaryCapability",
  "secondaryCapability",
  "department",
  "grade",
  "location",
  "country",
] as const;

function readArray(
  searchParams: URLSearchParams,

  key: string,
): string[] {
  return searchParams
    .getAll(key)
    .map((value) => value.trim())
    .filter(Boolean);
}

function writeArray(
  searchParams: URLSearchParams,

  key: string,
  values: string[],
) {
  searchParams.delete(key);

  for (const value of values) {
    searchParams.append(key, value);
  }
}

export function useResourceFilters(defaultFocusMonth: string) {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<ResourceFilters>(
    () => ({
      search: searchParams.get("search") ?? "",

      primaryCapability: readArray(searchParams, "primaryCapability"),

      secondaryCapability: readArray(searchParams, "secondaryCapability"),

      department: readArray(searchParams, "department"),

      grade: readArray(searchParams, "grade"),

      location: readArray(searchParams, "location"),

      country: readArray(searchParams, "country"),

      availabilityStatus: readArray(
        searchParams,
        "status",
      ) as ResourceAvailabilityStatusFilter[],

      focusMonth: searchParams.get("focusMonth") ?? defaultFocusMonth,
    }),
    [searchParams, defaultFocusMonth],
  );

  const setFilters = useCallback(
    (next: ResourceFilters) => {
      const params = new URLSearchParams(searchParams);

      if (next.search.trim() === "") {
        params.delete("search");
      } else {
        params.set("search", next.search);
      }

      for (const key of ARRAY_KEYS) {
        writeArray(params, key, next[key]);
      }

      writeArray(params, "status", next.availabilityStatus);

      if (next.focusMonth === defaultFocusMonth) {
        params.delete("focusMonth");
      } else {
        params.set("focusMonth", next.focusMonth);
      }

      setSearchParams(params, {
        replace: true,
      });
    },
    [defaultFocusMonth, searchParams, setSearchParams],
  );

  const clearAll = useCallback(() => {
    const params = new URLSearchParams(searchParams);

    params.delete("search");

    for (const key of ARRAY_KEYS) {
      params.delete(key);
    }

    params.delete("status");

    params.delete("focusMonth");

    setSearchParams(params, {
      replace: true,
    });
  }, [searchParams, setSearchParams]);

  const removeDimensionValue = useCallback(
    (
      dimension: ResourceDimension,

      value: string,
    ) => {
      setFilters({
        ...filters,

        [dimension]: filters[dimension].filter((item) => item !== value),
      });
    },
    [filters, setFilters],
  );

  return {
    filters,
    setFilters,
    clearAll,
    removeDimensionValue,
  };
}
