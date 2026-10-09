import { useCallback, useMemo, useState } from "react";

import { SearchX } from "lucide-react";

import { availabilityQueryContext } from "../../data";

import { POC_CURRENT_MONTH, PROJECT_TRACK_MONTHS } from "../../constants/poc";

import { getAvailabilityForRange } from "../../services/availabilityQueryService";

import { addMonths, getMonthRange } from "../../services/monthService";

import {
  getFilteredAvailabilityPopulation,
  getResourceFilterOptions,
} from "../../services/resourceFilterService";

import {
  buildResourceAvailabilityMatrixRows,
  getResourceAvailabilityMatrixSummary,
  sortResourceAvailabilityMatrixRows,
} from "../../services/resourceAvailabilityMatrixService";

import type {
  ResourceMatrixSort,
  ResourceMatrixSortField,
} from "../../types/resourceAvailabilityMatrix";

import { useResourceFilters } from "../../hooks/useResourceFilters";

import { formatHours, formatMonth } from "../../utils/formatters";

import { PlanningHorizonControl } from "../availability-overview/PlanningHorizonControl";

import { ActiveFilterSummary } from "../availability-filters/ActiveFilterSummary";

import { ResourceFilterBar } from "../availability-filters/ResourceFilterBar";

import { ResourceAvailabilityMatrix } from "../availability-overview/ResourceAvailabilityMatrix";

import { ResourceReleaseSummary } from "../resource-detail/ResourceReleaseSummary";

import { Card } from "../ui/Card";

import { EmptyState } from "../ui/EmptyState";

import { PageHeader } from "../ui/PageHeader";

const PLANNING_HORIZON_MONTHS = 4;

const RELEASE_HORIZON_MONTHS = PROJECT_TRACK_MONTHS.length;

function hasCalendarCoverage(startMonth: string): boolean {
  const requestedMonths = getMonthRange(startMonth, PLANNING_HORIZON_MONTHS);

  const availableMonths = new Set(
    availabilityQueryContext.workCalendar.map((record) => record.monthKey),
  );

  return requestedMonths.every((monthKey) => availableMonths.has(monthKey));
}

export function ResourcesPage() {
  const [startMonth, setStartMonth] = useState(POC_CURRENT_MONTH);

  const { filters, setFilters, clearAll, removeDimensionValue } =
    useResourceFilters(startMonth);

  const [sort, setSort] = useState<ResourceMatrixSort>({
    field: "availableHours",
    direction: "desc",
  });

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");

  const monthKeys = useMemo(
    () => getMonthRange(startMonth, PLANNING_HORIZON_MONTHS),
    [startMonth],
  );

  const effectiveFocusMonth = monthKeys.includes(filters.focusMonth)
    ? filters.focusMonth
    : monthKeys[0];

  const effectiveFilters = useMemo(
    () => ({
      ...filters,
      focusMonth: effectiveFocusMonth,
    }),
    [filters, effectiveFocusMonth],
  );

  const allRangeRecords = useMemo(
    () =>
      getAvailabilityForRange(
        availabilityQueryContext,
        startMonth,
        PLANNING_HORIZON_MONTHS,
      ),
    [startMonth],
  );

  /*
   * Release calculations use the complete
   * known Project Track planning horizon.
   *
   * This allows the resource matrix to remain
   * compact while still identifying releases
   * through March 2027.
   */
  const allReleaseRecords = useMemo(
    () =>
      getAvailabilityForRange(
        availabilityQueryContext,
        POC_CURRENT_MONTH,
        RELEASE_HORIZON_MONTHS,
      ),
    [],
  );

  const filteredRecords = useMemo(
    () =>
      getFilteredAvailabilityPopulation(
        allRangeRecords,
        availabilityQueryContext.employees,
        effectiveFilters,
      ),
    [allRangeRecords, effectiveFilters],
  );

  const filterOptions = useMemo(
    () =>
      getResourceFilterOptions(
        availabilityQueryContext.employees,
        effectiveFilters,
      ),
    [effectiveFilters],
  );

  const matrixRows = useMemo(
    () =>
      buildResourceAvailabilityMatrixRows(
        filteredRecords,
        monthKeys,
        effectiveFocusMonth,
      ),
    [filteredRecords, monthKeys, effectiveFocusMonth],
  );

  const sortedRows = useMemo(
    () => sortResourceAvailabilityMatrixRows(matrixRows, sort),
    [matrixRows, sort],
  );

  const summary = useMemo(
    () => getResourceAvailabilityMatrixSummary(matrixRows, effectiveFocusMonth),
    [matrixRows, effectiveFocusMonth],
  );

  const releasePopulation = useMemo(() => {
    const visibleIds = new Set(
      filteredRecords.map((record) => record.employeeId),
    );

    return allReleaseRecords.filter((record) =>
      visibleIds.has(record.employeeId),
    );
  }, [allReleaseRecords, filteredRecords]);

  const resourceOptions = useMemo(() => {
    const employees = new Map<string, string>();

    for (const record of releasePopulation) {
      employees.set(record.employeeId, record.employeeName);
    }

    return [...employees.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [releasePopulation]);

  const selectedResourceId = resourceOptions.some(
    ([employeeId]) => employeeId === selectedEmployeeId,
  )
    ? selectedEmployeeId
    : (resourceOptions[0]?.[0] ?? "");

  const previousStart = addMonths(startMonth, -1);
  const nextStart = addMonths(startMonth, 1);

  const handleSort = useCallback((field: ResourceMatrixSortField) => {
    setSort((current) => {
      if (current.field === field) {
        return {
          field,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }

      return {
        field,
        direction: field === "availableHours" ? "desc" : "asc",
      };
    });
  }, []);

  function handleHorizonChange(next: string) {
    if (!hasCalendarCoverage(next)) {
      return;
    }

    setStartMonth(next);

    setFilters({
      ...filters,
      focusMonth: next,
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Resource Availability"
        description="Employee-level availability and expected capacity release."
        actions={
          <PlanningHorizonControl
            startMonth={startMonth}
            numberOfMonths={PLANNING_HORIZON_MONTHS}
            onChange={handleHorizonChange}
            canGoPrevious={hasCalendarCoverage(previousStart)}
            canGoNext={hasCalendarCoverage(nextStart)}
          />
        }
      />

      <ResourceFilterBar
        filters={effectiveFilters}
        options={filterOptions}
        monthKeys={monthKeys}
        onFiltersChange={setFilters}
        onClearAll={clearAll}
      />

      <ActiveFilterSummary
        filters={effectiveFilters}
        onRemoveDimensionValue={removeDimensionValue}
        onClearStatus={() =>
          setFilters({
            ...filters,
            availabilityStatus: [],
          })
        }
        onClearSearch={() =>
          setFilters({
            ...filters,
            search: "",
          })
        }
        onClearAll={clearAll}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900">
            {summary.totalResources.toLocaleString("en-US")}
          </span>{" "}
          {summary.totalResources === 1 ? "resource" : "resources"}
          <span className="mx-2 text-slate-300">·</span>
          <span className="font-semibold text-slate-900">
            {summary.resourcesWithCapacity.toLocaleString("en-US")}
          </span>{" "}
          with capacity in{" "}
          <span className="font-medium text-slate-700">
            {formatMonth(summary.focusMonth)}
          </span>
          <span className="mx-2 text-slate-300">·</span>
          <span className="font-semibold text-slate-900">
            {formatHours(summary.totalAvailableHours)}
          </span>{" "}
          available
        </p>

        <button
          type="button"
          onClick={() => handleSort("availableHours")}
          className="self-start rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 outline-none hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-600 sm:self-auto"
        >
          Sort by focus-month availability
        </button>
      </div>

      {allRangeRecords.length === 0 ? (
        <Card padding={false}>
          <EmptyState
            icon={SearchX}
            title="No availability data"
            description="No availability data exists for the selected planning period."
          />
        </Card>
      ) : sortedRows.length === 0 ? (
        <Card padding={false}>
          <EmptyState
            icon={SearchX}
            title="No resources match the current filters"
            description="Clear or adjust the active filters to restore the resource population."
          />

          <div className="flex justify-center border-t border-slate-100 px-5 py-4">
            <button
              type="button"
              onClick={clearAll}
              className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white outline-none hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              Clear filters
            </button>
          </div>
        </Card>
      ) : (
        <>
          <ResourceAvailabilityMatrix
            rows={sortedRows}
            monthKeys={monthKeys}
            sort={sort}
            onSort={handleSort}
          />

          {selectedResourceId && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Resource Release Timing
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Review when a resource gains capacity within the known
                    planning horizon.
                  </p>
                </div>

                <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                  Resource
                  <select
                    value={selectedResourceId}
                    onChange={(event) =>
                      setSelectedEmployeeId(event.target.value)
                    }
                    className="min-w-[180px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    {resourceOptions.map(([employeeId, name]) => (
                      <option key={employeeId} value={employeeId}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <ResourceReleaseSummary
                records={releasePopulation}
                employeeId={selectedResourceId}
                focusMonth={effectiveFocusMonth}
                compact
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
