import { FolderSearch } from "lucide-react";
import { useMemo, useState } from "react";

import { availabilityQueryContext } from "../../data";
import { POC_CURRENT_MONTH } from "../../constants/poc";

import { RESOURCE_PRIORITY_WINDOW_DAYS } from "../../constants/resourcePlanning";

import { getProjectListRows } from "../../services/projectAvailabilityService";

import {
  filterProjectRows,
  getFilteredCoverageSummary,
  getProjectFilterOptions,
  getSupportedProjectDimensions,
} from "../../services/projectFilterService";

import { addMonths, getMonthRange } from "../../services/monthService";

import type { ProjectFilters } from "../../types/projectFilters";
import { DEFAULT_PROJECT_FILTERS } from "../../types/projectFilters";

import { formatMonth } from "../../utils/formatters";

import { PlanningHorizonControl } from "../availability-overview/PlanningHorizonControl";
import { ProjectActiveFilters } from "../project-filters/ProjectActiveFilters";
import { ProjectFilterBar } from "../project-filters/ProjectFilterBar";
import { ProjectTable } from "../projects/ProjectTable";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { PageHeader } from "../ui/PageHeader";

const PLANNING_HORIZON_MONTHS = 4;

function hasCalendarCoverage(startMonth: string): boolean {
  const requested = getMonthRange(startMonth, PLANNING_HORIZON_MONTHS);

  const months = new Set(
    availabilityQueryContext.workCalendar.map((record) => record.monthKey),
  );

  return requested.every((month) => months.has(month));
}

function getHorizonEndDate(monthKeys: string[]): string {
  const lastMonth = monthKeys[monthKeys.length - 1];

  if (!lastMonth) {
    return "";
  }

  const [year, month] = lastMonth.split("-").map(Number);

  const lastDay = new Date(Date.UTC(year, month, 0));

  return lastDay.toISOString().slice(0, 10);
}

export function ProjectsPage() {
  const [startMonth, setStartMonth] = useState(POC_CURRENT_MONTH);

  const [focusMonth, setFocusMonth] = useState(POC_CURRENT_MONTH);

  const [filters, setFilters] = useState<ProjectFilters>(
    DEFAULT_PROJECT_FILTERS,
  );

  const monthKeys = useMemo(
    () => getMonthRange(startMonth, PLANNING_HORIZON_MONTHS),
    [startMonth],
  );

  const effectiveFocusMonth = monthKeys.includes(focusMonth)
    ? focusMonth
    : monthKeys[0];

  const projectRows = useMemo(
    () =>
      getProjectListRows(
        availabilityQueryContext,
        startMonth,
        PLANNING_HORIZON_MONTHS,
        effectiveFocusMonth,
      ),
    [startMonth, effectiveFocusMonth],
  );

  const filterOptions = useMemo(
    () => getProjectFilterOptions(projectRows),
    [projectRows],
  );

  const supportedDimensions = useMemo(
    () => getSupportedProjectDimensions(projectRows),
    [projectRows],
  );

  const filteredRows = useMemo(
    () =>
      filterProjectRows(projectRows, filters, {
        focusMonth: effectiveFocusMonth,
        horizonMonths: monthKeys,
      }),
    [projectRows, filters, effectiveFocusMonth, monthKeys],
  );

  const coverageSummary = useMemo(
    () => getFilteredCoverageSummary(filteredRows),
    [filteredRows],
  );

  const planningHorizonEnd = useMemo(
    () => getHorizonEndDate(monthKeys),
    [monthKeys],
  );

  function handleHorizonChange(next: string) {
    if (!hasCalendarCoverage(next)) {
      return;
    }

    setStartMonth(next);
    setFocusMonth(next);
  }

  function clearFilters() {
    setFilters(DEFAULT_PROJECT_FILTERS);
  }

  const previousStart = addMonths(startMonth, -1);
  const nextStart = addMonths(startMonth, 1);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Projects"
        description="Explore project allocations, assigned resources, and planning priority."
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

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <ProjectFilterBar
            filters={filters}
            options={filterOptions}
            supportedDimensions={supportedDimensions}
            onChange={setFilters}
            onClearAll={clearFilters}
          />
        </div>

        <div className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
          <label
            htmlFor="project-focus-month"
            className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400"
          >
            Focus Month
          </label>

          <select
            id="project-focus-month"
            value={effectiveFocusMonth}
            onChange={(event) => setFocusMonth(event.target.value)}
            className="h-8 min-w-36 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            {monthKeys.map((monthKey) => (
              <option key={monthKey} value={monthKey}>
                {formatMonth(monthKey)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ProjectActiveFilters
        filters={filters}
        onChange={setFilters}
        onClearAll={clearFilters}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <p>
            <span className="font-semibold text-slate-900">
              {filteredRows.length.toLocaleString("en-US")}
            </span>{" "}
            {filteredRows.length === 1 ? "project" : "projects"}
            {filteredRows.length !== projectRows.length && (
              <> of {projectRows.length.toLocaleString("en-US")}</>
            )}
          </p>

          <span className="text-slate-300" aria-hidden="true">
            ·
          </span>

          <p>
            <span className="font-medium text-slate-700">
              {coverageSummary.assigned}
            </span>{" "}
            assigned
          </p>

          <span className="text-slate-300" aria-hidden="true">
            ·
          </span>

          <p>
            <span className="font-medium text-slate-700">
              {coverageSummary.unassigned}
            </span>{" "}
            unassigned
          </p>

          <span className="text-slate-300" aria-hidden="true">
            ·
          </span>

          <p>
            Effort shown for{" "}
            <span className="font-medium text-slate-700">
              {formatMonth(effectiveFocusMonth)}
            </span>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2 text-[11px] text-slate-500">
          <span>
            Today:{" "}
            <span className="font-medium text-slate-700">
              {new Date().toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
          </span>

          <span className="text-slate-300">·</span>

          <span>
            Priority window:{" "}
            <span className="font-medium text-slate-700">
              {RESOURCE_PRIORITY_WINDOW_DAYS} days
            </span>
          </span>
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <Card padding={false}>
          <EmptyState
            icon={FolderSearch}
            title="No projects match the current filters"
            description="Clear or adjust the active project filters to restore the project list."
          />

          <div className="flex justify-center border-t border-slate-100 px-5 py-4">
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white outline-none hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              Clear filters
            </button>
          </div>
        </Card>
      ) : (
        <ProjectTable
          rows={filteredRows}
          focusMonth={effectiveFocusMonth}
          planningHorizonEnd={planningHorizonEnd}
        />
      )}
    </div>
  );
}
