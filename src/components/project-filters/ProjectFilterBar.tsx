import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";

import { useEffect, useRef, useState } from "react";

import type {
  ProjectFilterOptions,
  ProjectFilters,
  SupportedProjectDimensions,
} from "../../types/projectFilters";

import { CompactMultiSelect } from "../availability-filters/CompactMultiSelect";

interface ProjectFilterBarProps {
  filters: ProjectFilters;

  options: ProjectFilterOptions;

  supportedDimensions: SupportedProjectDimensions;

  onChange: (filters: ProjectFilters) => void;

  onClearAll: () => void;
}

export function ProjectFilterBar({
  filters,
  options,
  supportedDimensions,
  onChange,
  onClearAll,
}: ProjectFilterBarProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleMouseDown(event: MouseEvent) {
      if (
        moreRef.current !== null &&
        !moreRef.current.contains(event.target as Node)
      ) {
        setMoreOpen(false);
      }
    }

    document.addEventListener("mousedown", handleMouseDown);

    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  const hasFilters =
    filters.search.trim() !== "" ||
    filters.statuses.length > 0 ||
    filters.primaryCapabilities.length > 0 ||
    filters.secondaryCapabilities.length > 0 ||
    filters.departments.length > 0 ||
    filters.locations.length > 0 ||
    filters.resourceCoverage !== "ALL" ||
    filters.timeline !== "ALL" ||
    filters.focusMonthActivity !== "ALL";

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
              onChange({
                ...filters,

                search: event.target.value,
              })
            }
            placeholder="Search projects or proposals..."
            aria-label="Search projects or proposals"
            className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <CompactMultiSelect
          label="Status"
          options={options.statuses}
          selected={filters.statuses}
          onChange={(values) =>
            onChange({
              ...filters,

              statuses: values,
            })
          }
        />

        {supportedDimensions.primaryCapability && (
          <CompactMultiSelect
            label="Primary Capability"
            options={options.primaryCapabilities}
            selected={filters.primaryCapabilities}
            onChange={(values) =>
              onChange({
                ...filters,

                primaryCapabilities: values,
              })
            }
          />
        )}

        {supportedDimensions.location && (
          <CompactMultiSelect
            label="Location"
            options={options.locations}
            selected={filters.locations}
            onChange={(values) =>
              onChange({
                ...filters,

                locations: values,
              })
            }
          />
        )}

        <select
          value={filters.resourceCoverage}
          onChange={(event) =>
            onChange({
              ...filters,

              resourceCoverage: event.target
                .value as ProjectFilters["resourceCoverage"],
            })
          }
          aria-label="Resource coverage"
          className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        >
          <option value="ALL">Resource Coverage</option>

          <option value="ASSIGNED">Assigned</option>

          <option value="UNASSIGNED">Unassigned</option>
        </select>

        <div ref={moreRef} className="relative">
          <button
            type="button"
            onClick={() => setMoreOpen((current) => !current)}
            aria-expanded={moreOpen}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <SlidersHorizontal
              className="size-3.5 text-slate-400"
              aria-hidden="true"
            />
            More Filters
            <ChevronDown
              className="size-3.5 text-slate-400"
              aria-hidden="true"
            />
          </button>

          {moreOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
              <div className="space-y-3">
                {supportedDimensions.secondaryCapability && (
                  <div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Secondary Capability
                    </p>

                    <CompactMultiSelect
                      label="Secondary Capability"
                      options={options.secondaryCapabilities}
                      selected={filters.secondaryCapabilities}
                      onChange={(values) =>
                        onChange({
                          ...filters,

                          secondaryCapabilities: values,
                        })
                      }
                    />
                  </div>
                )}

                {supportedDimensions.department && (
                  <div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Department
                    </p>

                    <CompactMultiSelect
                      label="Department"
                      options={options.departments}
                      selected={filters.departments}
                      onChange={(values) =>
                        onChange({
                          ...filters,

                          departments: values,
                        })
                      }
                    />
                  </div>
                )}

                <div>
                  <label
                    htmlFor="project-timeline-filter"
                    className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400"
                  >
                    Project Timeline
                  </label>

                  <select
                    id="project-timeline-filter"
                    value={filters.timeline}
                    onChange={(event) =>
                      onChange({
                        ...filters,

                        timeline: event.target
                          .value as ProjectFilters["timeline"],
                      })
                    }
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="ALL">All Projects</option>

                    <option value="ACTIVE_IN_FOCUS_MONTH">
                      Active in Focus Month
                    </option>

                    <option value="STARTING_IN_HORIZON">
                      Starting in Planning Horizon
                    </option>

                    <option value="ENDING_IN_HORIZON">
                      Ending in Planning Horizon
                    </option>

                    <option value="COMPLETED_BEFORE_FOCUS_MONTH">
                      Completed Before Focus Month
                    </option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="project-activity-filter"
                    className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-400"
                  >
                    Activity in Focus Month
                  </label>

                  <select
                    id="project-activity-filter"
                    value={filters.focusMonthActivity}
                    onChange={(event) =>
                      onChange({
                        ...filters,

                        focusMonthActivity: event.target
                          .value as ProjectFilters["focusMonthActivity"],
                      })
                    }
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="ALL">All Activity</option>

                    <option value="HAS_EFFORT">Has Effort</option>

                    <option value="NO_EFFORT">No Effort</option>
                  </select>
                </div>
              </div>
            </div>
          )}
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
