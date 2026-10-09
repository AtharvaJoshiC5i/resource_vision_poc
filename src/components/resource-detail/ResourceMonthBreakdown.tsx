import {
  ArrowUpRight,
} from "lucide-react";

import {
  Link,
} from "react-router-dom";

import type {
  EmployeeMonthAvailability,
} from "../../types/domain";

import {
  formatHours,
  formatLongMonth,
  formatPercentage,
} from "../../utils/formatters";

import {
  Card,
} from "../ui/Card";

interface ResourceMonthBreakdownProps {
  record:
    EmployeeMonthAvailability | null;
}

function getStatusLabel(
  status:
    EmployeeMonthAvailability["status"],
): string {
  switch (status) {
    case "AVAILABLE":
      return "Available";

    case "PARTIALLY_AVAILABLE":
      return "Partially Available";

    case "FULLY_ALLOCATED":
      return "Fully Allocated";

    case "OVER_ALLOCATED":
      return "Over-Allocated";
  }
}

function getStatusClasses(
  status:
    EmployeeMonthAvailability["status"],
): string {
  switch (status) {
    case "AVAILABLE":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "PARTIALLY_AVAILABLE":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "FULLY_ALLOCATED":
      return "border-slate-200 bg-slate-50 text-slate-600";

    case "OVER_ALLOCATED":
      return "border-red-200 bg-red-50 text-red-700";
  }
}

export function ResourceMonthBreakdown({
  record,
}: ResourceMonthBreakdownProps) {
  if (record === null) {
    return (
      <Card>
        <h2 className="text-sm font-semibold text-slate-900">
          Selected Month
        </h2>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-5">
          <p className="text-sm font-medium text-slate-700">
            Not in workforce for this month
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Availability is not calculated as usable workforce capacity for this period.
          </p>
        </div>
      </Card>
    );
  }

  const overAllocatedBy =
    Math.max(
      -record.availableHours,
      0,
    );

  return (
    <Card>
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Selected Month
          </p>

          <h2 className="mt-1 text-base font-semibold text-slate-900">
            {formatLongMonth(
              record.monthKey,
            )}
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-5">
          <Metric
            label="Capacity"
            value={formatHours(
              record.totalCapacityHours,
            )}
          />

          <Metric
            label="Allocated"
            value={formatHours(
              record.allocatedHours,
            )}
          />

          <Metric
            label="Available"
            value={formatHours(
              record.availableHours,
            )}
            attention={
              record.availableHours <
              0
            }
          />

          <Metric
            label="Availability"
            value={formatPercentage(
              record.availabilityPercentage,
            )}
            attention={
              record.availableHours <
              0
            }
          />

          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
              Status
            </p>

            <span
              className={`mt-1 inline-flex rounded-md border px-2 py-1 text-[10px] font-semibold ${getStatusClasses(
                record.status,
              )}`}
            >
              {getStatusLabel(
                record.status,
              )}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Capacity Breakdown
            </h3>

            <p className="mt-1 text-xs text-slate-500">
              Why this resource has{" "}
              <span
                className={
                  record.availableHours <
                  0
                    ? "font-semibold text-red-700"
                    : "font-semibold text-slate-700"
                }
              >
                {formatHours(
                  record.availableHours,
                )}
              </span>{" "}
              available.
            </p>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <div className="flex items-center justify-between bg-slate-50 px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-slate-800">
                Total Capacity
              </p>

              <p className="mt-0.5 text-[10px] text-slate-400">
                Monthly employee capacity
              </p>
            </div>

            <p className="text-sm font-semibold tabular-nums text-slate-900">
              {formatHours(
                record.totalCapacityHours,
              )}
            </p>
          </div>

          {record.projectAllocations.length >
          0 ? (
            <div className="divide-y divide-slate-100">
              {record.projectAllocations.map(
                (project) => (
                  <div
                    key={
                      project.projectId
                    }
                    className="flex items-center justify-between gap-4 bg-white px-4 py-3"
                  >
                    <div className="min-w-0 pl-3">
                      <Link
                        to={`/projects/${encodeURIComponent(
                          project.projectId,
                        )}`}
                        className="group inline-flex max-w-full items-center gap-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                      >
                        <span className="truncate text-xs font-medium text-slate-700 group-hover:text-blue-700">
                          {
                            project.projectName
                          }
                        </span>

                        <ArrowUpRight
                          className="size-3 shrink-0 text-slate-300 group-hover:text-blue-600"
                          aria-hidden="true"
                        />
                      </Link>

                      {project.proposalNumber.trim() !==
                        "" && (
                        <p className="mt-0.5 text-[10px] text-slate-400">
                          {
                            project.proposalNumber
                          }
                        </p>
                      )}
                    </div>

                    <p className="shrink-0 text-xs font-semibold tabular-nums text-slate-700">
                      −{" "}
                      {formatHours(
                        project.allocatedHours,
                      )}
                    </p>
                  </div>
                ),
              )}
            </div>
          ) : (
            <div className="bg-white px-4 py-4">
              <p className="text-xs text-slate-400">
                No project allocations in this month.
              </p>
            </div>
          )}

          <div
            className={`flex items-center justify-between border-t px-4 py-3 ${
              record.availableHours <
              0
                ? "border-red-100 bg-red-50"
                : "border-slate-200 bg-white"
            }`}
          >
            <div>
              <p
                className={`text-xs font-semibold ${
                  record.availableHours <
                  0
                    ? "text-red-700"
                    : "text-slate-900"
                }`}
              >
                Available
              </p>

              <p className="mt-0.5 text-[10px] text-slate-400">
                Capacity remaining after project allocations
              </p>
            </div>

            <p
              className={`text-sm font-semibold tabular-nums ${
                record.availableHours <
                0
                  ? "text-red-700"
                  : "text-slate-900"
              }`}
            >
              {formatHours(
                record.availableHours,
              )}
            </p>
          </div>
        </div>

        {overAllocatedBy >
          0 && (
          <div className="mt-3 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-red-700">
                Over capacity
              </p>

              <p className="mt-0.5 text-[10px] text-red-600">
                Project commitments exceed this employee's monthly capacity.
              </p>
            </div>

            <p className="text-sm font-semibold tabular-nums text-red-700">
              {formatHours(
                overAllocatedBy,
              )}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

function Metric({
  label,
  value,
  attention = false,
}: {
  label: string;
  value: string;
  attention?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p
        className={`mt-1 text-lg font-semibold tabular-nums ${
          attention
            ? "text-red-700"
            : "text-slate-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}