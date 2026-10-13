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

const STATUS_FILTER_OPTIONS = STATUS_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label,
  count: 0,
}));

const controlClass =
  "h-9 rounded-md border border-slate-200 bg-white text-xs text-slate-700 shadow-sm outline-none transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5";

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
    <div className="rounded-xl border border-slate-200/90 bg-white px-3.5 py-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="relative min-w-[12rem] flex-1 sm:min-w-[14rem] lg:max-w-[16rem]">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400"
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
            className={`${controlClass} w-full pl-8 pr-2.5 placeholder:text-slate-400`}
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
          label="Country"
          options={options.country}
          selected={filters.country}
          onChange={(values) => updateDimension("country", values)}
        />

        <CompactMultiSelect
          label="Location"
          options={options.location}
          selected={filters.location}
          onChange={(values) => updateDimension("location", values)}
        />

        <CompactMultiSelect
          label="Status"
          options={STATUS_FILTER_OPTIONS}
          selected={filters.availabilityStatus}
          showCounts={false}
          onChange={(values) =>
            onFiltersChange({
              ...filters,
              availabilityStatus: values as ResourceAvailabilityStatusFilter[],
            })
          }
        />

        {hasFilters && (
          <button
            type="button"
            onClick={onClearAll}
            className={`${controlClass} border-transparent px-2.5 font-medium text-slate-600 shadow-none hover:bg-slate-50 hover:text-slate-900 focus-visible:ring-blue-600/30`}
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
