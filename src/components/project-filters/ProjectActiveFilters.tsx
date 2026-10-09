import type { ProjectFilters } from "../../types/projectFilters";

import { getActiveProjectFilterCount } from "../../services/projectFilterService";

interface ProjectActiveFiltersProps {
  filters: ProjectFilters;

  onChange: (filters: ProjectFilters) => void;

  onClearAll: () => void;
}

export function ProjectActiveFilters({
  filters,
  onChange,
  onClearAll,
}: ProjectActiveFiltersProps) {
  const count = getActiveProjectFilterCount(filters);

  if (count === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs font-medium text-slate-500">
        {count} {count === 1 ? "filter" : "filters"} active
      </span>

      {filters.statuses.map((value) => (
        <Chip
          key={`status-${value}`}
          label={value}
          onRemove={() =>
            onChange({
              ...filters,

              statuses: filters.statuses.filter((item) => item !== value),
            })
          }
        />
      ))}

      {filters.primaryCapabilities.map((value) => (
        <Chip
          key={`primary-${value}`}
          label={value}
          onRemove={() =>
            onChange({
              ...filters,

              primaryCapabilities: filters.primaryCapabilities.filter(
                (item) => item !== value,
              ),
            })
          }
        />
      ))}

      {filters.secondaryCapabilities.map((value) => (
        <Chip
          key={`secondary-${value}`}
          label={value}
          onRemove={() =>
            onChange({
              ...filters,

              secondaryCapabilities: filters.secondaryCapabilities.filter(
                (item) => item !== value,
              ),
            })
          }
        />
      ))}

      {filters.departments.map((value) => (
        <Chip
          key={`department-${value}`}
          label={value}
          onRemove={() =>
            onChange({
              ...filters,

              departments: filters.departments.filter((item) => item !== value),
            })
          }
        />
      ))}

      {filters.locations.map((value) => (
        <Chip
          key={`location-${value}`}
          label={value}
          onRemove={() =>
            onChange({
              ...filters,

              locations: filters.locations.filter((item) => item !== value),
            })
          }
        />
      ))}

      {filters.resourceCoverage !== "ALL" && (
        <Chip
          label={
            filters.resourceCoverage === "ASSIGNED" ? "Assigned" : "Unassigned"
          }
          onRemove={() =>
            onChange({
              ...filters,

              resourceCoverage: "ALL",
            })
          }
        />
      )}

      {filters.timeline !== "ALL" && (
        <Chip
          label={getTimelineLabel(filters.timeline)}
          onRemove={() =>
            onChange({
              ...filters,

              timeline: "ALL",
            })
          }
        />
      )}

      {filters.focusMonthActivity !== "ALL" && (
        <Chip
          label={
            filters.focusMonthActivity === "HAS_EFFORT"
              ? "Has Effort"
              : "No Effort"
          }
          onRemove={() =>
            onChange({
              ...filters,

              focusMonthActivity: "ALL",
            })
          }
        />
      )}

      {filters.search.trim() !== "" && (
        <Chip
          label={`Search: ${filters.search}`}
          onRemove={() =>
            onChange({
              ...filters,

              search: "",
            })
          }
        />
      )}

      <button
        type="button"
        onClick={onClearAll}
        className="ml-1 rounded px-1.5 py-1 text-[11px] font-medium text-blue-700 outline-none hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-600"
      >
        Clear all
      </button>
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      title={`Remove ${label} filter`}
      className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600 outline-none hover:border-slate-300 hover:bg-white focus-visible:ring-2 focus-visible:ring-blue-600"
    >
      {label} ×
    </button>
  );
}

function getTimelineLabel(value: ProjectFilters["timeline"]): string {
  switch (value) {
    case "ACTIVE_IN_FOCUS_MONTH":
      return "Active in Focus Month";

    case "STARTING_IN_HORIZON":
      return "Starting in Horizon";

    case "ENDING_IN_HORIZON":
      return "Ending in Horizon";

    case "COMPLETED_BEFORE_FOCUS_MONTH":
      return "Completed Before Focus Month";

    case "ALL":
      return "All Projects";
  }
}
