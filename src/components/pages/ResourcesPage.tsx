import { useCallback, useEffect, useMemo, useState } from "react";

import { SearchX } from "lucide-react";

import { useResourceData } from "../../context/ResourceDataContext";

import { POC_CURRENT_MONTH, PROJECT_TRACK_MONTHS } from "../../constants/poc";

import {
  getAvailabilityForMonthKeys,
  getAvailabilityForRange,
} from "../../services/availabilityQueryService";

import {
  addMonths,
  compareMonthKeys,
  getMonthRange,
} from "../../services/monthService";

import {
  getPlanningCurrentMonth,
  getPlanningMonthKeys,
} from "../../services/planningHorizonRuntime";

import { hasCalendarCoverage } from "../../utils/calendarCoverage";

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

import { ActiveFilterSummary } from "../availability-filters/ActiveFilterSummary";

import { ResourceFilterBar } from "../availability-filters/ResourceFilterBar";

import { ResourceAvailabilityMatrix } from "../availability-overview/ResourceAvailabilityMatrix";

import { ResourceReleaseOutlookPanel } from "../resources/ResourceReleaseOutlookPanel";

import { Card } from "../ui/Card";

import { EmptyState } from "../ui/EmptyState";

import { PageHeader } from "../ui/PageHeader";

import { ResourceMatrixMonthControls } from "../resources/ResourceMatrixMonthControls";

const DEFAULT_MATRIX_MONTH_COUNT = 4;

const RELEASE_HORIZON_MONTHS = PROJECT_TRACK_MONTHS.length;

const DEFAULT_RESOURCES_PAGE_SIZE = 10;

const RESOURCES_PAGE_SIZE_OPTIONS = [10, 20] as const;

export function ResourcesPage() {
  const { availabilityQueryContext } = useResourceData();

  const calendarMonthKeys = useMemo(
    () =>
      availabilityQueryContext.workCalendar.map((record) => record.monthKey),
    [availabilityQueryContext.workCalendar],
  );

  const planningMonthKeys = useMemo(() => getPlanningMonthKeys(), []);

  const [planningStartMonth, setPlanningStartMonth] = useState(
    () => getPlanningCurrentMonth(),
  );

  const [customViewEnabled, setCustomViewEnabled] = useState(false);

  const standardMonthKeys = useMemo(
    () => getMonthRange(planningStartMonth, DEFAULT_MATRIX_MONTH_COUNT),
    [planningStartMonth],
  );

  const [customMonthKeys, setCustomMonthKeys] = useState<string[]>(
    standardMonthKeys,
  );

  const monthKeys = useMemo(() => {
    const source = customViewEnabled ? customMonthKeys : standardMonthKeys;

    return [...source].sort(compareMonthKeys);
  }, [customViewEnabled, customMonthKeys, standardMonthKeys]);

  const matrixAnchorMonth = monthKeys[0] ?? planningStartMonth;

  const { filters, setFilters, clearAll, removeDimensionValue } =
    useResourceFilters(matrixAnchorMonth);

  const [sort, setSort] = useState<ResourceMatrixSort>({
    field: "availableHours",
    direction: "desc",
  });

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_RESOURCES_PAGE_SIZE);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");

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
      getAvailabilityForMonthKeys(
        availabilityQueryContext,
        monthKeys,
      ),
    [availabilityQueryContext, monthKeys],
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

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const paginatedRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;

    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, safePage, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [effectiveFilters, monthKeys, planningStartMonth, customViewEnabled, sort.field, sort.direction]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

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

  const selectedRow = useMemo(
    () =>
      matrixRows.find((row) => row.employeeId === selectedEmployeeId) ?? null,
    [matrixRows, selectedEmployeeId],
  );

  useEffect(() => {
    if (
      selectedEmployeeId !== "" &&
      !matrixRows.some((row) => row.employeeId === selectedEmployeeId)
    ) {
      setSelectedEmployeeId("");
    }
  }, [matrixRows, selectedEmployeeId]);

  const handleSelectEmployee = useCallback((employeeId: string) => {
    setSelectedEmployeeId((current) =>
      current === employeeId ? "" : employeeId,
    );
  }, []);

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

  const previousPlanningStart = addMonths(planningStartMonth, -1);
  const nextPlanningStart = addMonths(planningStartMonth, 1);

  function syncFocusMonth(keys: string[]) {
    if (keys.length === 0) {
      return;
    }

    if (!keys.includes(filters.focusMonth)) {
      setFilters({
        ...filters,
        focusMonth: keys[0],
      });
    }
  }

  function handlePlanningStartMonthChange(next: string) {
    if (
      !hasCalendarCoverage(
        next,
        DEFAULT_MATRIX_MONTH_COUNT,
        calendarMonthKeys,
      )
    ) {
      return;
    }

    setPlanningStartMonth(next);

    const nextStandard = getMonthRange(next, DEFAULT_MATRIX_MONTH_COUNT);

    if (!customViewEnabled) {
      syncFocusMonth(nextStandard);
    }

    setFilters({
      ...filters,
      focusMonth: next,
    });
  }

  function handleCustomMonthKeysChange(nextMonthKeys: string[]) {
    const sorted = [...nextMonthKeys].sort(compareMonthKeys);

    setCustomMonthKeys(sorted);
    syncFocusMonth(sorted);
  }

  function handleResetToPlanningPeriod() {
    const anchor = getPlanningCurrentMonth();

    setCustomViewEnabled(false);
    setPlanningStartMonth(anchor);

    const resetMonths = getMonthRange(anchor, DEFAULT_MATRIX_MONTH_COUNT);

    setCustomMonthKeys(resetMonths);

    setFilters({
      ...filters,
      focusMonth: anchor,
    });
  }

  function handleEnableCustomView() {
    setCustomMonthKeys(standardMonthKeys);
    setCustomViewEnabled(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resource Availability"
        description="Employee-level availability and expected capacity release."
        actions={
          <ResourceMatrixMonthControls
            customViewEnabled={customViewEnabled}
            onCustomViewEnabledChange={(enabled) => {
              if (enabled) {
                handleEnableCustomView();
              } else {
                setCustomViewEnabled(false);
              }
            }}
            planningStartMonth={planningStartMonth}
            planningMonthCount={DEFAULT_MATRIX_MONTH_COUNT}
            onPlanningStartMonthChange={handlePlanningStartMonthChange}
            canGoPlanningPrevious={hasCalendarCoverage(
              previousPlanningStart,
              DEFAULT_MATRIX_MONTH_COUNT,
              calendarMonthKeys,
            )}
            canGoPlanningNext={hasCalendarCoverage(
              nextPlanningStart,
              DEFAULT_MATRIX_MONTH_COUNT,
              calendarMonthKeys,
            )}
            customMonthKeys={customMonthKeys}
            availableMonthKeys={planningMonthKeys}
            onCustomMonthKeysChange={handleCustomMonthKeysChange}
            onResetToPlanningPeriod={handleResetToPlanningPeriod}
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
            rows={paginatedRows}
            monthKeys={monthKeys}
            highlightMonthKey={effectiveFocusMonth}
            sort={sort}
            onSort={handleSort}
            selectedEmployeeId={selectedEmployeeId || null}
            onSelectEmployee={handleSelectEmployee}
            pagination={{
              totalItems: sortedRows.length,
              page: safePage,
              pageSize,
              pageSizeOptions: RESOURCES_PAGE_SIZE_OPTIONS,
              onPageChange: setPage,
              onPageSizeChange: setPageSize,
            }}
          />

          <ResourceReleaseOutlookPanel
            row={selectedRow}
            matrixMonthKeys={monthKeys}
            focusMonth={effectiveFocusMonth}
            releaseRecords={releasePopulation}
          />
        </>
      )}
    </div>
  );
}
