import { ArrowUpRight } from "lucide-react";

import { Link } from "react-router-dom";

import type { EmployeeMonthAvailability } from "../../types/domain";

import type { ResourceAvailabilityMatrixRow } from "../../types/resourceAvailabilityMatrix";

import { getExpectedRelease } from "../../services/resourceReleaseService";

import { compareMonthKeys } from "../../services/monthService";

import {
  formatHours,
  formatMonth,
  formatMonthShort,
} from "../../utils/formatters";

import { AvailabilityMonthCell } from "../availability-overview/AvailabilityMonthCell";

import { Card } from "../ui/Card";

import { ResourceReleaseMilestones } from "./ResourceReleaseMilestones";

const MAX_BEYOND_MATRIX_MONTHS = 3;

function formatAllocatedUntil(value: string | undefined): string {
  if (value === undefined || value.trim() === "") {
    return "—";
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);

  if (match === null) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(
    new Date(
      Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
    ),
  );
}

function getStatusLabel(
  status: EmployeeMonthAvailability["status"] | undefined,
): string {
  switch (status) {
    case "AVAILABLE":
      return "Available";

    case "PARTIALLY_AVAILABLE":
      return "Partial";

    case "FULLY_ALLOCATED":
      return "Allocated";

    case "OVER_ALLOCATED":
      return "Over-allocated";

    default:
      return "—";
  }
}

function getBeyondMatrixMonthKeys(
  matrixMonthKeys: string[],
  release: ReturnType<typeof getExpectedRelease>,
): string[] {
  if (release === null || matrixMonthKeys.length === 0) {
    return [];
  }

  const lastMatrixKey = matrixMonthKeys[matrixMonthKeys.length - 1];

  const candidates = new Set<string>();

  if (
    release.fullAvailabilityMonth !== null &&
    compareMonthKeys(release.fullAvailabilityMonth, lastMatrixKey) > 0
  ) {
    candidates.add(release.fullAvailabilityMonth);
  }

  for (const event of release.releaseEvents) {
    if (compareMonthKeys(event.monthKey, lastMatrixKey) > 0) {
      candidates.add(event.monthKey);
    }
  }

  return [...candidates]
    .sort(compareMonthKeys)
    .slice(0, MAX_BEYOND_MATRIX_MONTHS);
}

interface ResourceReleaseOutlookPanelProps {
  row: ResourceAvailabilityMatrixRow | null;
  matrixMonthKeys: string[];
  focusMonth: string;
  releaseRecords: EmployeeMonthAvailability[];
}

export function ResourceReleaseOutlookPanel({
  row,
  matrixMonthKeys,
  focusMonth,
  releaseRecords,
}: ResourceReleaseOutlookPanelProps) {
  if (row === null) {
    return (
      <Card padding={false}>
        <div className="px-5 py-8 text-center">
          <p className="text-sm font-medium text-slate-700">Release outlook</p>

          <p className="mt-1 text-xs text-slate-500">
            Select a resource in the table above to see when capacity is
            expected to increase.
          </p>
        </div>
      </Card>
    );
  }

  const release = getExpectedRelease(
    releaseRecords,
    row.employeeId,
    focusMonth,
  );

  if (release === null) {
    return (
      <Card padding={false}>
        <div className="px-5 py-6 text-center text-xs text-slate-500">
          No release data for {row.employeeName} in {formatMonth(focusMonth)}.
        </div>
      </Card>
    );
  }

  const focusRecord = releaseRecords.find(
    (record) =>
      record.employeeId === row.employeeId && record.monthKey === focusMonth,
  );

  const recordsByMonth = new Map(
    releaseRecords
      .filter((record) => record.employeeId === row.employeeId)
      .map((record) => [record.monthKey, record]),
  );

  const beyondMonthKeys = getBeyondMatrixMonthKeys(matrixMonthKeys, release);

  const isFullyAvailableInFocus = focusRecord?.status === "AVAILABLE";

  return (
    <Card padding={false}>
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900">
              Release outlook
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              {row.employeeName}
              {" · "}
              {row.grade}
              {" · "}
              {row.primaryCapability}
            </p>
          </div>

          <Link
            to={`/resources/${encodeURIComponent(row.employeeId)}`}
            className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-blue-700 outline-none hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            View full profile
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>

        <p className="mt-3 text-xs leading-5 text-slate-700">
          <span className="font-semibold text-slate-900">
            {formatMonth(focusMonth)}:
          </span>{" "}
          {formatHours(release.currentAvailableHours)} available
          {focusRecord !== undefined && (
            <>
              {" · "}
              {getStatusLabel(focusRecord.status)}
              {" · "}
              {formatHours(focusRecord.totalCapacityHours)} capacity,{" "}
              {formatHours(focusRecord.allocatedHours)} allocated
            </>
          )}
        </p>

        <p className="mt-2 text-[11px] leading-5 text-slate-500">
          {isFullyAvailableInFocus
            ? "Fully available in the focus month."
            : release.releaseContext}
        </p>
      </div>

      <div className="border-b border-slate-100 px-5 py-4">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-slate-500">
          Matrix months
        </p>

        <div
          className="grid gap-2"
          style={{
            gridTemplateColumns: `repeat(${matrixMonthKeys.length}, minmax(0, 1fr))`,
          }}
        >
          {matrixMonthKeys.map((monthKey) => (
            <div key={monthKey} className="min-w-0">
              <p
                className={`mb-1.5 text-center text-[10px] font-semibold uppercase tracking-wide ${
                  monthKey === focusMonth ? "text-blue-700" : "text-slate-500"
                }`}
              >
                {formatMonthShort(monthKey)}
              </p>

              <AvailabilityMonthCell
                monthKey={monthKey}
                availability={recordsByMonth.get(monthKey) ?? null}
              />
            </div>
          ))}
        </div>

        {beyondMonthKeys.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Beyond matrix
            </p>

            <div
              className="grid gap-2 opacity-90"
              style={{
                gridTemplateColumns: `repeat(${beyondMonthKeys.length}, minmax(0, 1fr))`,
              }}
            >
              {beyondMonthKeys.map((monthKey) => (
                <div key={monthKey} className="min-w-0">
                  <p className="mb-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {formatMonthShort(monthKey)}
                  </p>

                  <AvailabilityMonthCell
                    monthKey={monthKey}
                    availability={recordsByMonth.get(monthKey) ?? null}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-6 px-5 py-4 lg:grid-cols-[1fr_minmax(12rem,16rem)]">
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Upcoming capacity increases
          </p>

          <ResourceReleaseMilestones
            events={release.releaseEvents}
            focusMonth={focusMonth}
          />
        </div>

        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Drivers
          </p>

          <dl className="space-y-3 text-xs">
            <div>
              <dt className="text-slate-500">Allocated until</dt>
              <dd className="mt-0.5 font-medium text-slate-800">
                {formatAllocatedUntil(row.allocatedUntil)}
              </dd>
            </div>

            <div>
              <dt className="text-slate-500">Active projects</dt>
              <dd className="mt-1 space-y-1">
                {row.projects.length === 0 ? (
                  <span className="text-slate-500">No active projects</span>
                ) : (
                  row.projects.slice(0, 4).map((project) => (
                    <p
                      key={project.projectId || project.projectName}
                      className="font-medium text-slate-800"
                    >
                      {project.projectName}
                      {project.projectEndDate !== undefined && (
                        <span className="font-normal text-slate-500">
                          {" "}
                          · ends {formatAllocatedUntil(project.projectEndDate)}
                        </span>
                      )}
                    </p>
                  ))
                )}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </Card>
  );
}
