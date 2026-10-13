import { useMemo, useState } from "react";

import { useLocation } from "react-router-dom";

import { CalendarRange } from "lucide-react";

import { useResourceData } from "../../context/ResourceDataContext";

import { POC_CURRENT_MONTH } from "../../constants/poc";

import { getAvailabilityForRange } from "../../services/availabilityQueryService";

import { getMonthlyAvailabilitySummary } from "../../services/availabilityAggregationService";

import { aggregateAvailabilityByDimension } from "../../services/availabilityDimensionService";

import { getUpcomingAvailabilityTransitions } from "../../services/upcomingAvailabilityService";

import {
  getUpcomingAvailabilityMonthSummaries,
  getAvailabilityAttentionItems,
} from "../../services/availabilityAttentionService";

import {
  getResourceFilterOptions,
  getFilteredAvailabilityPopulation,
} from "../../services/resourceFilterService";

import { addMonths, getMonthRange } from "../../services/monthService";

import { hasCalendarCoverage } from "../../utils/calendarCoverage";

import type { ResourceDimension } from "../../types/resourceFilters";

import {
  buildDrillPathFromFilters,
  drillIntoDimension,
  drillToBreadcrumbIndex,
} from "../../utils/dimensionDrill";

import { useResourceFilters } from "../../hooks/useResourceFilters";

import { AvailabilitySummaryCards } from "../availability-overview/AvailabilitySummaryCards";

import { ForwardAvailability } from "../availability-overview/ForwardAvailability";

import { PlanningHorizonControl } from "../availability-overview/PlanningHorizonControl";

import { UpcomingAvailability } from "../availability-overview/UpcomingAvailability";

import { AvailabilityAttention } from "../availability-overview/AvailabilityAttention";

import { UpcomingResourcePreview } from "../availability-overview/UpcomingResourcePreview";

import { ActiveFilterSummary } from "../availability-filters/ActiveFilterSummary";

import { AvailabilityDimensionSummary } from "../availability-filters/AvailabilityDimensionSummary";

import { ResourceFilterBar } from "../availability-filters/ResourceFilterBar";

import { Card } from "../ui/Card";

import { EmptyState } from "../ui/EmptyState";

import { PageHeader } from "../ui/PageHeader";

/**
 * Resource Vision 2.0
 *
 * Availability Overview
 *
 * Existing functionality:
 * - Monthly workforce availability
 * - Planning horizon
 * - Shared resource filters
 * - KPI summaries
 * - Forward availability
 * - Dimension aggregation
 * - Capacity composition
 * - Upcoming availability
 * - Resource preview
 * - Availability attention
 *
 * New functionality:
 * - Resource Release Forecast
 *
 * All calculations remain in the existing
 * services and canonical Availability Engine.
 */

const PLANNING_HORIZON_MONTHS = 7;

export function AvailabilityPage() {
  const { availabilityQueryContext, loading, mode } = useResourceData();

  const calendarMonthKeys = useMemo(
    () =>
      availabilityQueryContext.workCalendar.map((record) => record.monthKey),
    [availabilityQueryContext.workCalendar],
  );

  const location = useLocation();

  const [startMonth, setStartMonth] = useState(POC_CURRENT_MONTH);

  const [groupBy, setGroupBy] =
    useState<ResourceDimension>("primaryCapability");

  const { filters, setFilters, clearAll, removeDimensionValue } =
    useResourceFilters(startMonth);

  const resourcesHref = `/resources${location.search}`;

  /**
   * Planning horizon
   */
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

  /**
   * Canonical availability records
   *
   * All existing and new availability
   * features consume these records.
   */
  const allRangeRecords = useMemo(
    () =>
      getAvailabilityForRange(
        availabilityQueryContext,
        startMonth,
        PLANNING_HORIZON_MONTHS,
      ),
    [startMonth],
  );

  /**
   * Shared filtered population
   *
   * Release forecasts must respect the
   * same filters as every other section.
   */
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

  /**
   * Monthly availability summaries
   */
  const summaries = useMemo(
    () =>
      monthKeys.map((monthKey) =>
        getMonthlyAvailabilitySummary(filteredRecords, monthKey),
      ),
    [filteredRecords, monthKeys],
  );

  const selectedSummary = useMemo(
    () =>
      summaries.find((summary) => summary.monthKey === effectiveFocusMonth) ??
      summaries[0] ??
      null,
    [summaries, effectiveFocusMonth],
  );

  const selectedRecords = useMemo(
    () =>
      selectedSummary === null
        ? []
        : filteredRecords.filter(
            (record) => record.monthKey === selectedSummary.monthKey,
          ),
    [filteredRecords, selectedSummary],
  );

  /**
   * Existing upcoming availability
   */
  const transitions = useMemo(
    () => getUpcomingAvailabilityTransitions(filteredRecords),
    [filteredRecords],
  );

  const upcomingSummaries = useMemo(
    () => getUpcomingAvailabilityMonthSummaries(filteredRecords),
    [filteredRecords],
  );

  /**
   * Existing availability attention
   */
  const attentionItems = useMemo(
    () => getAvailabilityAttentionItems(filteredRecords),
    [filteredRecords],
  );

  /**
   * Availability by dimension
   */
  const dimensionRows = useMemo(
    () =>
      selectedSummary === null
        ? []
        : aggregateAvailabilityByDimension(
            filteredRecords,
            groupBy,
            selectedSummary.monthKey,
          ),
    [filteredRecords, groupBy, selectedSummary],
  );

  const dimensionDrillPath = useMemo(
    () => buildDrillPathFromFilters(effectiveFilters),
    [effectiveFilters],
  );

  /**
   * Planning horizon navigation
   */
  const previousStart = addMonths(startMonth, -1);

  const nextStart = addMonths(startMonth, 1);

  function handleHorizonChange(next: string) {
    if (
      !hasCalendarCoverage(next, PLANNING_HORIZON_MONTHS, calendarMonthKeys)
    ) {
      return;
    }

    setStartMonth(next);

    setFilters({
      ...filters,
      focusMonth: next,
    });
  }

  function handleFocusMonthChange(monthKey: string) {
    setFilters({
      ...filters,
      focusMonth: monthKey,
    });
  }

  function handleDimensionDrill(value: string) {
    const { filters: drilledFilters, nextDimension } = drillIntoDimension(
      effectiveFilters,
      groupBy,
      value,
    );

    setFilters(drilledFilters);

    if (nextDimension !== null) {
      setGroupBy(nextDimension);
    }
  }

  function handleDimensionDrillBreadcrumb(breadcrumbIndex: number) {
    const { filters: drilledFilters, groupBy: nextGroupBy } =
      drillToBreadcrumbIndex(effectiveFilters, breadcrumbIndex);

    setFilters(drilledFilters);
    setGroupBy(nextGroupBy);
  }

  /**
   * Availability states
   */
  const hasAvailabilityData = allRangeRecords.length > 0;

  const hasFilteredResources = filteredRecords.length > 0;

  return (
    <div className="space-y-6">
      {mode === "organization" && loading && (
        <div
          className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900"
          role="status"
        >
          Loading organization data from Azure SQL…
        </div>
      )}

      {/* Page header and planning horizon */}
      <PageHeader
        title="Resource Availability"
        description="See how many hours each person can take on, month by month, after planned project effort."
        actions={
          <PlanningHorizonControl
            startMonth={startMonth}
            numberOfMonths={PLANNING_HORIZON_MONTHS}
            onChange={handleHorizonChange}
            canGoPrevious={hasCalendarCoverage(
              previousStart,
              PLANNING_HORIZON_MONTHS,
              calendarMonthKeys,
            )}
            canGoNext={hasCalendarCoverage(
              nextStart,
              PLANNING_HORIZON_MONTHS,
              calendarMonthKeys,
            )}
          />
        }
      />

      {/* Shared resource filters */}
      <ResourceFilterBar
        filters={effectiveFilters}
        options={filterOptions}
        monthKeys={monthKeys}
        onFiltersChange={setFilters}
        onClearAll={clearAll}
      />

      {/* Active filter context */}
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

      {/* Availability content */}
      {!hasAvailabilityData ? (
        <Card padding={false}>
          <EmptyState
            icon={CalendarRange}
            title="No resource availability data"
            description="No availability data exists for this planning horizon."
          />
        </Card>
      ) : !hasFilteredResources ? (
        <Card padding={false}>
          <EmptyState
            icon={CalendarRange}
            title="No resources match the current filters"
            description="Clear or adjust the active filters to restore resource availability data."
          />

          <div className="flex justify-center border-t border-slate-100 px-5 py-4">
            <button
              type="button"
              onClick={clearAll}
              className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white outline-none transition-colors hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              Clear filters
            </button>
          </div>
        </Card>
      ) : selectedSummary === null ? (
        <Card padding={false}>
          <EmptyState
            icon={CalendarRange}
            title="No availability summary"
            description="Availability summary data could not be generated for this planning horizon."
          />
        </Card>
      ) : (
        <>
          {/* Workforce position KPIs */}
          <AvailabilitySummaryCards summary={selectedSummary} />

          {/* Forward month-by-month availability */}
          <ForwardAvailability
            summaries={summaries}
            selectedMonth={selectedSummary.monthKey}
            onSelectMonth={handleFocusMonthChange}
          />

          {/* Availability by selected dimension */}
          <AvailabilityDimensionSummary
            dimension={groupBy}
            monthKey={selectedSummary.monthKey}
            rows={dimensionRows}
            monthRecords={selectedRecords}
            drillPath={dimensionDrillPath}
            onDimensionChange={setGroupBy}
            onDrillInto={handleDimensionDrill}
            onDrillBreadcrumb={handleDimensionDrillBreadcrumb}
          />

          <UpcomingAvailability
            summaries={upcomingSummaries}
            transitions={transitions}
            records={filteredRecords}
          />

          {/* Existing availability attention */}
          <AvailabilityAttention items={attentionItems} />

          {/* Resource preview and drill-down */}
          <UpcomingResourcePreview
            records={filteredRecords}
            resourcesHref={resourcesHref}
          />
        </>
      )}
    </div>
  );
}
