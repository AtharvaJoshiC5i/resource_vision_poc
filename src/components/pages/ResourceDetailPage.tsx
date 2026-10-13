import { useMemo, useState } from "react";

import { ArrowLeft, SearchX } from "lucide-react";

import { Link, useParams } from "react-router-dom";

import { useResourceData } from "../../context/ResourceDataContext";

import {
  getPlanningCurrentMonth,
  getPlanningMonthKeys,
} from "../../services/planningHorizonRuntime";

import { getResourceDetailAvailability } from "../../services/resourceDetailAvailabilityService";

import { getEmployeeAvailabilityRange } from "../../services/availabilityQueryService";

import { addMonths, getMonthRange } from "../../services/monthService";

import { hasCalendarCoverage as hasHorizonCalendarCoverage } from "../../utils/calendarCoverage";

import { PlanningHorizonControl } from "../availability-overview/PlanningHorizonControl";

import { ResourceAvailabilityTimeline } from "../resource-detail/ResourceAvailabilityTimeline";

import { ResourceMonthBreakdown } from "../resource-detail/ResourceMonthBreakdown";

import { ResourceProjectCommitments } from "../resource-detail/ResourceProjectCommitments";

import { ResourceUpcomingAvailability } from "../resource-detail/ResourceUpcomingAvailability";

import { ResourceReleaseSummary } from "../resource-detail/ResourceReleaseSummary";

import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";

/**
 * Resource Vision 2.0
 *
 * Resource Detail with time-aware availability.
 *
 * Existing:
 * - Employee information
 * - Monthly availability timeline
 * - Capacity breakdown
 * - Project commitments
 * - Upcoming availability
 *
 * New:
 * - Expected resource release
 * - Next capacity increase
 * - Full availability month
 *
 * All calculations remain in services.
 */

const PLANNING_HORIZON_MONTHS = 4;

function getReleaseHorizonMonthCount(): number {
  const monthKeys = getPlanningMonthKeys();

  return monthKeys.length > 0 ? monthKeys.length : 7;
}

export function ResourceDetailPage() {
  const { availabilityQueryContext } = useResourceData();

  const calendarMonthKeys = useMemo(
    () =>
      availabilityQueryContext.workCalendar.map((calendar) => calendar.monthKey),
    [availabilityQueryContext.workCalendar],
  );

  const { employeeId } = useParams<{
    employeeId: string;
  }>();

  const decodedEmployeeId =
    employeeId === undefined ? "" : decodeURIComponent(employeeId).trim();

  const planningAnchorMonth = getPlanningCurrentMonth();

  const [startMonth, setStartMonth] = useState(planningAnchorMonth);

  const [selectedMonth, setSelectedMonth] = useState(planningAnchorMonth);

  /**
   * Existing planning horizon.
   */
  const monthKeys = useMemo(
    () => getMonthRange(startMonth, PLANNING_HORIZON_MONTHS),
    [startMonth],
  );

  /**
   * Existing canonical Resource Detail.
   */
  const detail = useMemo(
    () =>
      decodedEmployeeId === ""
        ? null
        : getResourceDetailAvailability(
            availabilityQueryContext,
            decodedEmployeeId,
            startMonth,
            PLANNING_HORIZON_MONTHS,
          ),
    [availabilityQueryContext, decodedEmployeeId, startMonth],
  );

  /**
   * Selected month breakdown.
   */
  const effectiveSelectedMonth = monthKeys.includes(selectedMonth)
    ? selectedMonth
    : monthKeys[0];

  const selectedRecord = useMemo(
    () =>
      detail?.availability.find(
        (record) => record.monthKey === effectiveSelectedMonth,
      ) ?? null,
    [detail, effectiveSelectedMonth],
  );

  /**
   * New:
   *
   * Fetch employee availability across the
   * complete Project Track planning horizon.
   *
   * This supports expected releases through
   * March 2027 even when the visible timeline
   * only displays four months.
   */
  const releaseRecords = useMemo(
    () =>
      decodedEmployeeId === ""
        ? []
        : getEmployeeAvailabilityRange(
            availabilityQueryContext,
            decodedEmployeeId,
            planningAnchorMonth,
            getReleaseHorizonMonthCount(),
          ),
    [availabilityQueryContext, decodedEmployeeId, planningAnchorMonth],
  );

  const previousStart = addMonths(startMonth, -1);

  const nextStart = addMonths(startMonth, 1);

  function handleHorizonChange(next: string) {
    if (
      !hasHorizonCalendarCoverage(
        next,
        PLANNING_HORIZON_MONTHS,
        calendarMonthKeys,
      )
    ) {
      return;
    }

    setStartMonth(next);
    setSelectedMonth(next);
  }

  if (detail === null) {
    return (
      <div className="space-y-5">
        <Link
          to="/resources"
          className="inline-flex items-center gap-1.5 rounded text-xs font-medium text-slate-500 outline-none hover:text-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Back to Resources
        </Link>

        <Card padding={false}>
          <EmptyState
            icon={SearchX}
            title="Resource not found"
            description="No employee exists for this resource ID."
          />
        </Card>
      </div>
    );
  }

  const { employee } = detail;

  return (
    <div className="space-y-5">
      {/* Employee header */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link
            to="/resources"
            className="mb-3 inline-flex items-center gap-1.5 rounded text-xs font-medium text-slate-500 outline-none hover:text-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Back to Resources
          </Link>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-slate-950">
                {employee.employeeName}
              </h1>

              <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                {employee.employeeStatus}
              </span>
            </div>

            <p className="mt-1 text-xs text-slate-400">{employee.employeeId}</p>

            <p className="mt-3 text-sm font-medium text-slate-700">
              {employee.primaryCapability}

              {employee.secondaryCapability.trim() !== "" && (
                <>
                  {" · "}
                  {employee.secondaryCapability}
                </>
              )}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              {employee.grade}
              {" · "}
              {employee.department}
              {" · "}
              {employee.location}, {employee.country}
            </p>
          </div>
        </div>

        <PlanningHorizonControl
          startMonth={startMonth}
          numberOfMonths={PLANNING_HORIZON_MONTHS}
          onChange={handleHorizonChange}
          canGoPrevious={hasHorizonCalendarCoverage(
            previousStart,
            PLANNING_HORIZON_MONTHS,
            calendarMonthKeys,
          )}
          canGoNext={hasHorizonCalendarCoverage(
            nextStart,
            PLANNING_HORIZON_MONTHS,
            calendarMonthKeys,
          )}
        />
      </div>

      {/* Existing monthly availability timeline */}
      <ResourceAvailabilityTimeline
        records={detail.availability}
        monthKeys={monthKeys}
        selectedMonth={effectiveSelectedMonth}
        onSelectMonth={setSelectedMonth}
      />

      {/*
       * New expected release summary.
       *
       * Uses canonical employee availability.
       *
       * No calculations are performed here.
       */}
      <ResourceReleaseSummary
        records={releaseRecords}
        employeeId={decodedEmployeeId}
        focusMonth={effectiveSelectedMonth}
      />

      {/* Existing selected month breakdown */}
      <ResourceMonthBreakdown record={selectedRecord} />

      {/* Existing project commitments */}
      <ResourceProjectCommitments
        commitments={detail.projectCommitments}
        monthKeys={monthKeys}
      />

      {/* Existing upcoming availability */}
      <ResourceUpcomingAvailability transitions={detail.transitions} />
    </div>
  );
}
