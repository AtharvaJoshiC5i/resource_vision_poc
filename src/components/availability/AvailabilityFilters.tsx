import type { AvailabilityFilters as AvailabilityFilterValues } from "../../types/availabilityExplorer";

import type { AvailabilityFilterOptions } from "../../services/availabilityExplorerService";

import { formatMonth } from "../../utils/formatters";

import { Card } from "../ui/Card";

interface AvailabilityFiltersProps {
  filters: AvailabilityFilterValues;
  options: AvailabilityFilterOptions;
  activeFilterCount: number;

  onFilterChange: (
    key: keyof AvailabilityFilterValues,
    value: string | undefined,
  ) => void;

  onReset: () => void;
}

interface FilterSelectProps {
  id: string;
  label: string;
  value?: string;
  options: string[];
  allLabel?: string;
  onChange: (value: string | undefined) => void;
}

function FilterSelect({
  id,
  label,
  value,
  options,
  allLabel = "All",
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
        <option value="">{allLabel}</option>

        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

export function AvailabilityFilters({
  filters,
  options,
  activeFilterCount,
  onFilterChange,
  onReset,
}: AvailabilityFiltersProps) {
  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Filters</h2>

          <p className="mt-1 text-xs text-slate-500">
            {activeFilterCount === 0
              ? "No filters applied"
              : `${activeFilterCount} ${
                  activeFilterCount === 1 ? "filter" : "filters"
                } applied`}
          </p>
        </div>

        <button
          type="button"
          onClick={onReset}
          disabled={activeFilterCount === 0}
          className="self-start rounded-lg px-3 py-2 text-sm font-medium text-blue-700 outline-none hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent sm:self-auto"
        >
          Reset filters
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <label
            htmlFor="availability-month"
            className="mb-1.5 block text-xs font-medium text-slate-600"
          >
            Month
          </label>

          <select
            id="availability-month"
            value={filters.month ?? ""}
            onChange={(event) =>
              onFilterChange(
                "month",
                event.target.value === "" ? undefined : event.target.value,
              )
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">All Months</option>

            {options.months.map((monthKey) => (
              <option key={monthKey} value={monthKey}>
                {formatMonth(monthKey)}
              </option>
            ))}
          </select>
        </div>

        <FilterSelect
          id="availability-primary-capability"
          label="Primary Capability"
          value={filters.primaryCapability}
          options={options.primaryCapabilities}
          onChange={(value) => onFilterChange("primaryCapability", value)}
        />

        <FilterSelect
          id="availability-secondary-capability"
          label="Secondary Capability"
          value={filters.secondaryCapability}
          options={options.secondaryCapabilities}
          onChange={(value) => onFilterChange("secondaryCapability", value)}
        />

        <FilterSelect
          id="availability-department"
          label="Department"
          value={filters.department}
          options={options.departments}
          onChange={(value) => onFilterChange("department", value)}
        />

        <FilterSelect
          id="availability-grade"
          label="Grade"
          value={filters.grade}
          options={options.grades}
          onChange={(value) => onFilterChange("grade", value)}
        />

        <FilterSelect
          id="availability-country"
          label="Country"
          value={filters.country}
          options={options.countries}
          onChange={(value) => onFilterChange("country", value)}
        />

        <FilterSelect
          id="availability-location"
          label="Location"
          value={filters.location}
          options={options.locations}
          onChange={(value) => onFilterChange("location", value)}
        />
      </div>
    </Card>
  );
}
