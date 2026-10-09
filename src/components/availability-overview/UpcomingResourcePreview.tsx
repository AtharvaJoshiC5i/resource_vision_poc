import { ArrowUpRight } from "lucide-react";

import { Link } from "react-router-dom";

import type { EmployeeMonthAvailability } from "../../types/domain";

import { formatHours, formatMonthShort } from "../../utils/formatters";

import { Card } from "../ui/Card";

interface UpcomingResourcePreviewProps {
  records: EmployeeMonthAvailability[];

  maxResources?: number;
  resourcesHref?: string;
}

interface ResourcePreview {
  employeeId: string;
  employeeName: string;

  primaryCapability: string;
  grade: string;

  months: EmployeeMonthAvailability[];

  gainedHours: number;
}

function buildPreview(
  records: EmployeeMonthAvailability[],

  maxResources: number,
): ResourcePreview[] {
  const groups = new Map<string, EmployeeMonthAvailability[]>();

  for (const record of records) {
    const existing = groups.get(record.employeeId) ?? [];

    existing.push(record);

    groups.set(record.employeeId, existing);
  }

  const previews: ResourcePreview[] = [];

  for (const employeeRecords of groups.values()) {
    const sorted = [...employeeRecords].sort((left, right) =>
      left.monthKey.localeCompare(right.monthKey),
    );

    if (sorted.length < 2) {
      continue;
    }

    const first = sorted[0];

    const last = sorted[sorted.length - 1];

    const gainedHours = last.availableHours - first.availableHours;

    if (gainedHours <= 0) {
      continue;
    }

    previews.push({
      employeeId: first.employeeId,

      employeeName: first.employeeName,

      primaryCapability: first.primaryCapability,

      grade: first.grade,

      months: sorted,

      gainedHours,
    });
  }

  return previews
    .sort((left, right) => right.gainedHours - left.gainedHours)
    .slice(0, maxResources);
}

export function UpcomingResourcePreview({
  records,
  maxResources = 6,
  resourcesHref = "/resources",
}: UpcomingResourcePreviewProps) {
  const resources = buildPreview(records, maxResources);

  return (
    <Card padding={false}>
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Resource Preview
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Resources gaining meaningful capacity across the planning horizon.
          </p>
        </div>

        <Link
          to={resourcesHref}
          className="shrink-0 text-xs font-medium text-blue-700 outline-none hover:text-blue-800 focus-visible:rounded focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          View all resources
        </Link>
      </div>

      {resources.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-slate-500">
            No upcoming resource capacity changes were found.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {resources.map((resource) => (
            <div key={resource.employeeId} className="px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Link
                    to={`/resources/${encodeURIComponent(resource.employeeId)}`}
                    className="group inline-flex items-center gap-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  >
                    <span className="truncate text-sm font-medium text-slate-900 group-hover:text-blue-700">
                      {resource.employeeName}
                    </span>

                    <ArrowUpRight
                      className="size-3.5 shrink-0 text-slate-400 group-hover:text-blue-600"
                      aria-hidden="true"
                    />
                  </Link>

                  <p className="mt-0.5 text-xs text-slate-500">
                    {resource.primaryCapability}
                    {" · "}
                    {resource.grade}
                  </p>
                </div>

                <p className="shrink-0 text-xs font-semibold text-slate-700">
                  +{formatHours(resource.gainedHours)}
                </p>
              </div>

              <div className="mt-3 flex gap-2 overflow-x-auto">
                {resource.months.map((month) => (
                  <div
                    key={month.monthKey}
                    className="min-w-20 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      {formatMonthShort(month.monthKey)}
                    </p>

                    <p
                      className={`mt-1 text-xs font-medium ${
                        month.availableHours < 0
                          ? "text-red-700"
                          : "text-slate-700"
                      }`}
                    >
                      {formatHours(month.availableHours)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
