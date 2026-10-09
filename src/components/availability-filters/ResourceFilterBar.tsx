import { Search } from "lucide-react";

import type {
  ResourceFilterOptions,
  ResourceFilters,
  ResourceAvailabilityStatusFilter,
} from "../../types/resourceFilters";

import { CompactMultiSelect } from "./CompactMultiSelect";

interface ResourceFilterBarProps {
  filters: ResourceFilters;

  options: ResourceFilterOptions;

  monthKeys: string[];

  onFiltersChange: (filters: ResourceFilters) => void;

  onClearAll: () => void;
}

const STATUS_OPTIONS: {
  value: ResourceAvailabilityStatusFilter;
  label: string;
}[] = [
  {
    value: "WITH_CAPACITY",
    label: "With Capacity",
  },
  {
    value: "AVAILABLE",
    label: "Available",
  },
  {
    value: "PARTIALLY_AVAILABLE",
    label: "Partially Available",
  },
  {
    value: "FULLY_ALLOCATED",
    label: "Fully Allocated",
  },
  {
    value: "OVER_ALLOCATED",
    label: "Over-Allocated",
  },
];

export function ResourceFilterBar({
  filters,
  options,
  onFiltersChange,
  onClearAll,
}: ResourceFilterBarProps) {
  function updateDimension(
    key:
      | "primaryCapability"
      | "secondaryCapability"
      | "department"
      | "grade"
      | "location"
      | "country",

    values: string[],
  ) {
    onFiltersChange({
      ...filters,
      [key]: values,
    });
  }

  function toggleStatus(value: ResourceAvailabilityStatusFilter) {
    const selected = filters.availabilityStatus;

    onFiltersChange({
      ...filters,

      availabilityStatus: selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value],
    });
  }

  const hasFilters =
    filters.search.trim() !== "" ||
    filters.primaryCapability.length > 0 ||
    filters.secondaryCapability.length > 0 ||
    filters.department.length > 0 ||
    filters.grade.length > 0 ||
    filters.location.length > 0 ||
    filters.country.length > 0 ||
    filters.availabilityStatus.length > 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1 lg:max-w-72">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />

          <input
            type="search"
            value={filters.search}
            onChange={(event) =>
              onFiltersChange({
                ...filters,

                search: event.target.value,
              })
            }
            placeholder="Search resources..."
            aria-label="Search resources"
            className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <CompactMultiSelect
          label="Primary Capability"
          options={options.primaryCapability}
          selected={filters.primaryCapability}
          onChange={(values) => updateDimension("primaryCapability", values)}
        />

        <CompactMultiSelect
          label="Secondary Capability"
          options={options.secondaryCapability}
          selected={filters.secondaryCapability}
          onChange={(values) => updateDimension("secondaryCapability", values)}
        />

        <CompactMultiSelect
          label="Department"
          options={options.department}
          selected={filters.department}
          onChange={(values) => updateDimension("department", values)}
        />

        <CompactMultiSelect
          label="Grade"
          options={options.grade}
          selected={filters.grade}
          onChange={(values) => updateDimension("grade", values)}
        />

        <CompactMultiSelect
          label="Location"
          options={options.location}
          selected={filters.location}
          onChange={(values) => updateDimension("location", values)}
        />

        <CompactMultiSelect
          label="Country"
          options={options.country}
          selected={filters.country}
          onChange={(values) => updateDimension("country", values)}
        />

        <div className="relative">
          <select
            value={filters.availabilityStatus[0] ?? ""}
            onChange={(event) => {
              const value = event.target.value;

              if (value === "") {
                onFiltersChange({
                  ...filters,

                  availabilityStatus: [],
                });

                return;
              }

              toggleStatus(value as ResourceAvailabilityStatusFilter);
            }}
            aria-label="Availability status"
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">Status</option>

            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={onClearAll}
            className="h-9 rounded-lg px-3 text-xs font-medium text-blue-700 outline-none hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
