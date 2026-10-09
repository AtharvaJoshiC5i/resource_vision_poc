import { useMemo, useState } from "react";
import { ArrowLeft, FolderSearch } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { availabilityQueryContext } from "../../data";
import { POC_CURRENT_MONTH, PROJECT_TRACK_MONTHS } from "../../constants/poc";

import { RESOURCE_PRIORITY_WINDOW_DAYS } from "../../constants/resourcePlanning";

import { getProjectAvailabilityDetail } from "../../services/projectAvailabilityService";
import { getAvailabilityForRange } from "../../services/availabilityQueryService";
import { isAvailableByRequirementStart } from "../../services/availabilityTimingService";
import { addMonths, getMonthRange } from "../../services/monthService";

import { PlanningHorizonControl } from "../availability-overview/PlanningHorizonControl";
import { ProjectMonthlyEffortSummary } from "../projects/ProjectMonthlyEffortSummary";
import { ProjectResourceAllocationTable } from "../projects/ProjectResourceAllocationTable";
import { ProjectPlanningPriority } from "../projects/ProjectPlanningPriority";
import { AvailabilityTimingStatus } from "../projects/AvailabilityTimingStatus";

import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";

const PLANNING_HORIZON_MONTHS = 4;

function hasCalendarCoverage(startMonth: string): boolean {
  const requested = getMonthRange(startMonth, PLANNING_HORIZON_MONTHS);

  const available = new Set(
    availabilityQueryContext.workCalendar.map((record) => record.monthKey),
  );

  return requested.every((month) => available.has(month));
}

function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);

  if (!match) return value || "—";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(
    new Date(
      Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
    ),
  );
}

function getMonthEndDate(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);

  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

function ProjectMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-slate-400">{label}</span>
      <span className="ml-1.5 font-medium text-slate-700">{value}</span>
    </div>
  );
}

export function ProjectDetailPage() {
  const { projectId } = useParams<{
    projectId: string;
  }>();

  const decodedProjectId =
    projectId === undefined ? "" : decodeURIComponent(projectId).trim();

  const [startMonth, setStartMonth] = useState(POC_CURRENT_MONTH);

  const monthKeys = useMemo(
    () => getMonthRange(startMonth, PLANNING_HORIZON_MONTHS),
    [startMonth],
  );

  const detail = useMemo(
    () =>
      decodedProjectId === ""
        ? null
        : getProjectAvailabilityDetail(
            availabilityQueryContext,
            decodedProjectId,
            startMonth,
            PLANNING_HORIZON_MONTHS,
          ),
    [decodedProjectId, startMonth],
  );

  const planningHorizonEnd = useMemo(() => {
    const last = monthKeys[monthKeys.length - 1];

    return last ? getMonthEndDate(last) : undefined;
  }, [monthKeys]);

  /*
   * Use the complete known Project Track
   * horizon for timing assessment.
   *
   * This is independent of the four-month
   * visible allocation table.
   */
  const fullPlanningRecords = useMemo(
    () =>
      getAvailabilityForRange(
        availabilityQueryContext,
        POC_CURRENT_MONTH,
        PROJECT_TRACK_MONTHS.length,
      ),
    [],
  );

  const timingRows = useMemo(() => {
    if (detail === null) {
      return [];
    }

    return detail.resources.map((resource) => ({
      employeeId: resource.employeeId,
      employeeName: resource.employeeName,
      result: isAvailableByRequirementStart(
        fullPlanningRecords,
        resource.employeeId,
        detail.project.startDate,
      ),
    }));
  }, [detail, fullPlanningRecords]);

  const previousStart = addMonths(startMonth, -1);
  const nextStart = addMonths(startMonth, 1);

  function handleHorizonChange(next: string) {
    if (!hasCalendarCoverage(next)) return;

    setStartMonth(next);
  }

  if (detail === null) {
    return (
      <div className="space-y-5">
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-700"
        >
          <ArrowLeft className="size-3.5" />
          Back to Projects
        </Link>

        <Card padding={false}>
          <EmptyState
            icon={FolderSearch}
            title="Project not found"
            description="No project exists for this project ID."
          />
        </Card>
      </div>
    );
  }

  const { project } = detail;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link
            to="/projects"
            className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-700"
          >
            <ArrowLeft className="size-3.5" />
            Back to Projects
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-slate-950">
              {project.projectName}
            </h1>

            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600">
              {project.projectStatus}
            </span>

            <ProjectPlanningPriority
              startDate={project.startDate}
              planningHorizonEnd={planningHorizonEnd}
              showDays={false}
            />
          </div>

          <p className="mt-1 text-xs text-slate-400">
            {project.proposalNumber}
          </p>

          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs">
            <ProjectMeta label="Start" value={formatDate(project.startDate)} />

            <ProjectMeta label="End" value={formatDate(project.endDate)} />

            <ProjectMeta
              label="Assigned Resources"
              value={detail.uniqueResourceCount.toLocaleString("en-US")}
            />
          </div>
        </div>

        <PlanningHorizonControl
          startMonth={startMonth}
          numberOfMonths={PLANNING_HORIZON_MONTHS}
          onChange={handleHorizonChange}
          canGoPrevious={hasCalendarCoverage(previousStart)}
          canGoNext={hasCalendarCoverage(nextStart)}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <p className="text-xs font-semibold text-slate-800">
            Planning Priority
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Based on the project start date, independently of lifecycle status.
          </p>
        </div>

        <div className="text-right text-xs text-slate-600">
          <p>Today: {new Date().toLocaleDateString("en-GB")}</p>
          <p className="mt-1">
            Urgency window:{" "}
            <span className="font-semibold text-slate-800">
              {RESOURCE_PRIORITY_WINDOW_DAYS} days
            </span>
          </p>
        </div>
      </div>

      <ProjectMonthlyEffortSummary months={detail.monthlyEffort} />

      <ProjectResourceAllocationTable
        rows={detail.resources}
        monthKeys={monthKeys}
      />

      <Card padding={false}>
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Availability by Project Start
          </h2>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            Monthly availability of assigned resources in the project's starting
            month.
          </p>
        </div>

        {timingRows.length === 0 ? (
          <div className="px-5 py-8 text-center text-xs text-slate-500">
            No assigned resources to evaluate.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Resource
                  </th>

                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Available Hours
                  </th>

                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Timing Assessment
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {timingRows.map((row) => (
                  <tr key={row.employeeId}>
                    <td className="px-5 py-3">
                      <Link
                        to={`/resources/${encodeURIComponent(row.employeeId)}`}
                        className="text-xs font-semibold text-slate-800 hover:text-blue-700"
                      >
                        {row.employeeName}
                      </Link>
                    </td>

                    <td className="px-4 py-3 text-right text-xs font-medium tabular-nums text-slate-800">
                      {row.result === null
                        ? "—"
                        : `${row.result.availableHours.toLocaleString(
                            "en-US",
                          )}h`}
                    </td>

                    <td className="px-5 py-3">
                      <AvailabilityTimingStatus result={row.result} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-3">
          <p className="text-[11px] leading-5 text-slate-500">
            This is a monthly planning assessment, not confirmation of
            availability on the exact project start day. No assignment or
            reservation is performed.
          </p>
        </div>
      </Card>
    </div>
  );
}
