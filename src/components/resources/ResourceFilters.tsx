import { Search } from "lucide-react";

import type { AvailabilityStatus } from "../../types/resourceMonthly";

import type {
  ResourceFilterOptions,
  ResourceFilters as ResourceFilterValues,
} from "../../types/resources";

import { RESOURCE_MONTHS } from "../../services/resourcesService";

import { formatMonth } from "../../utils/formatters";

import { Card } from "../ui/Card";

interface ResourceFiltersProps {
  filters: ResourceFilterValues;
  options: ResourceFilterOptions;

  searchText: string;
  activeFilterCount: number;

  onSearchChange: (value: string) => void;

  onFilterChange: (
    key: keyof ResourceFilterValues,
    value: string | undefined,
  ) => void;

  onReset: () => void;
}

interface FilterSelectProps {
  id: string;
  label: string;
  value?: string;
  options: string[];

  onChange: (value: string | undefined) => void;
}

function FilterSelect({
  id,
  label,
  value,
  options,
  onChange,
}: FilterSelectProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-medium text-slate-600"
      >
        {label}
      </label>

      <select
        id={id}
        value={value ?? ""}
        onChange={(event) =>
          onChange(event.target.value === "" ? undefined : event.target.value)
        }
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      >
        <option value="">All</option>

        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

const STATUS_OPTIONS: {
  value: AvailabilityStatus;
  label: string;
}[] = [
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
    label: "Over Allocated",
  },
];

export function ResourceFilters({
  filters,
  options,
  searchText,
  activeFilterCount,
  onSearchChange,
  onFilterChange,
  onReset,
}: ResourceFiltersProps) {
  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Resource Filters
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            {activeFilterCount === 0 && searchText.trim() === ""
              ? "No additional filters applied"
              : `${activeFilterCount} ${
                  activeFilterCount === 1 ? "filter" : "filters"
                } applied${searchText.trim() !== "" ? " · Search active" : ""}`}
          </p>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="self-start rounded-lg px-3 py-2 text-sm font-medium text-blue-700 outline-none hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-600 sm:self-auto"
        >
          Reset filters
        </button>
      </div>

      <div className="mt-5">
        <label
          htmlFor="resource-search"
          className="mb-1.5 block text-xs font-medium text-slate-600"
        >
          Search
        </label>

        <div className="relative max-w-xl">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />

          <input
            id="resource-search"
            type="search"
            value={searchText}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search by employee name or ID..."
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <label
            htmlFor="resource-month"
            className="mb-1.5 block text-xs font-medium text-slate-600"
          >
            Month
          </label>

          <select
            id="resource-month"
            value={filters.month}
            onChange={(event) => onFilterChange("month", event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            {RESOURCE_MONTHS.map((monthKey) => (
              <option key={monthKey} value={monthKey}>
                {formatMonth(monthKey)}
              </option>
            ))}
          </select>
        </div>

        <FilterSelect
          id="resource-primary-capability"
          label="Primary Capability"
          value={filters.primaryCapability}
          options={options.primaryCapabilities}
          onChange={(value) => onFilterChange("primaryCapability", value)}
        />

        <FilterSelect
          id="resource-secondary-capability"
          label="Secondary Capability"
          value={filters.secondaryCapability}
          options={options.secondaryCapabilities}
          onChange={(value) => onFilterChange("secondaryCapability", value)}
        />

        <FilterSelect
          id="resource-department"
          label="Department"
          value={filters.department}
          options={options.departments}
          onChange={(value) => onFilterChange("department", value)}
        />

        <FilterSelect
          id="resource-grade"
          label="Grade"
          value={filters.grade}
          options={options.grades}
          onChange={(value) => onFilterChange("grade", value)}
        />

        <FilterSelect
          id="resource-country"
          label="Country"
          value={filters.country}
          options={options.countries}
          onChange={(value) => onFilterChange("country", value)}
        />

        <FilterSelect
          id="resource-location"
          label="Location"
          value={filters.location}
          options={options.locations}
          onChange={(value) => onFilterChange("location", value)}
        />

        <div>
          <label
            htmlFor="resource-status"
            className="mb-1.5 block text-xs font-medium text-slate-600"
          >
            Availability Status
          </label>

          <select
            id="resource-status"
            value={filters.status ?? ""}
            onChange={(event) =>
              onFilterChange(
                "status",
                event.target.value === "" ? undefined : event.target.value,
              )
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">All</option>

            {STATUS_OPTIONS.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Card>
  );
}
