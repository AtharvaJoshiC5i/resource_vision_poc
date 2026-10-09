import {
  ArrowUpRight,
} from "lucide-react";

import {
  Link,
} from "react-router-dom";

import type {
  EmployeeProjectCommitment,
} from "../../services/resourceDetailAvailabilityService";

import { getCurrentMonthKey } from "../../services/monthService";

import {
  formatHours,
  formatMonthShort,
} from "../../utils/formatters";

import {
  Card,
} from "../ui/Card";

interface ResourceProjectCommitmentsProps {
  commitments:
    EmployeeProjectCommitment[];

  monthKeys: string[];
}

function formatProjectDate(
  value: string,
): string {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})/.exec(
      value,
    );

  if (match === null) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    },
  ).format(
    new Date(
      Date.UTC(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
      ),
    ),
  );
}

export function ResourceProjectCommitments({
  commitments,
  monthKeys,
}: ResourceProjectCommitmentsProps) {
  const currentMonth = getCurrentMonthKey();

  return (
    <Card padding={false}>
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-900">
          Project Commitments
        </h2>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          Monthly project effort consuming this resource's capacity.
        </p>
      </div>

      {commitments.length ===
      0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm font-medium text-slate-700">
            No planned project commitments
          </p>

          <p className="mt-1 text-xs text-slate-500">
            No Project Track allocations exist for this resource in the visible planning horizon.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-slate-50">
              <tr>
                <Header>
                  Project
                </Header>

                <Header>
                  Start
                </Header>

                <Header>
                  End
                </Header>

                {monthKeys.map(
                  (monthKey) => (
                    <Header
                      key={
                        monthKey
                      }
                      align="right"
                      className={
                        monthKey === currentMonth
                          ? "border-blue-200 bg-blue-100 text-blue-800"
                          : ""
                      }
                    >
                      {formatMonthShort(
                        monthKey,
                      )}
                    </Header>
                  ),
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 bg-white">
              {commitments.map(
                (commitment) => {
                  const lookup =
                    new Map(
                      commitment.months.map(
                        (month) => [
                          month.monthKey,
                          month.allocatedHours,
                        ],
                      ),
                    );

                  return (
                    <tr
                      key={
                        commitment.project.projectId
                      }
                      className="transition-colors hover:bg-slate-50/70"
                    >
                      <td className="min-w-60 px-5 py-3.5">
                        <Link
                          to={`/projects/${encodeURIComponent(
                            commitment.project.projectId,
                          )}`}
                          className="group inline-flex max-w-full items-center gap-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                        >
                          <span className="truncate text-xs font-semibold text-slate-900 group-hover:text-blue-700">
                            {
                              commitment.project.projectName
                            }
                          </span>

                          <ArrowUpRight
                            className="size-3.5 shrink-0 text-slate-300 group-hover:text-blue-600"
                            aria-hidden="true"
                          />
                        </Link>

                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-400">
                          {commitment.project.proposalNumber.trim() !==
                            "" && (
                            <span>
                              {
                                commitment.project.proposalNumber
                              }
                            </span>
                          )}

                          <span>
                            {
                              commitment.project.projectStatus
                            }
                          </span>
                        </div>
                      </td>

                      <td className="min-w-28 px-3 py-3.5 text-xs text-slate-600">
                        {formatProjectDate(
                          commitment.project.startDate,
                        )}
                      </td>

                      <td className="min-w-28 px-3 py-3.5 text-xs text-slate-600">
                        {formatProjectDate(
                          commitment.project.endDate,
                        )}
                      </td>

                      {monthKeys.map(
                        (monthKey) => {
                          const hours =
                            lookup.get(
                              monthKey,
                            );

                          return (
                            <td
                              key={
                                monthKey
                              }
                              className={`min-w-24 px-3 py-3.5 text-right ${
                                monthKey === currentMonth
                                  ? "bg-blue-50/80"
                                  : "border-l border-slate-100"
                              }`}
                            >
                              <span
                                className={`text-xs tabular-nums ${
                                  hours ===
                                  undefined
                                    ? "text-slate-300"
                                    : "font-semibold text-slate-700"
                                }`}
                              >
                                {hours ===
                                undefined
                                  ? "—"
                                  : formatHours(
                                      hours,
                                    )}
                              </span>
                            </td>
                          );
                        },
                      )}
                    </tr>
                  );
                },
              )}

              <TotalAllocationRow
                commitments={
                  commitments
                }
                currentMonth={
                  currentMonth
                }
                monthKeys={
                  monthKeys
                }
              />
            </tbody>
          </table>
        </div>
      )}

      {commitments.length >
        0 && (
        <div className="border-t border-slate-100 bg-slate-50/40 px-5 py-3">
          <p className="text-[10px] leading-4 text-slate-400">
            Project start/end dates provide commitment context. Monthly allocation hours remain authoritative for availability.
          </p>
        </div>
      )}
    </Card>
  );
}

function TotalAllocationRow({
  commitments,
  currentMonth,
  monthKeys,
}: {
  commitments:
    EmployeeProjectCommitment[];

  currentMonth: string;

  monthKeys: string[];
}) {
  return (
    <tr className="border-t border-slate-200 bg-slate-50/70">
      <td
        colSpan={3}
        className="px-5 py-3 text-xs font-semibold text-slate-700"
      >
        Total Allocated
      </td>

      {monthKeys.map(
        (monthKey) => {
          const total =
            commitments.reduce(
              (
                sum,
                commitment,
              ) =>
                sum +
                (
                  commitment.months.find(
                    (month) =>
                      month.monthKey ===
                      monthKey,
                  )
                    ?.allocatedHours ??
                  0
                ),
              0,
            );

          return (
            <td
              key={monthKey}
              className={`px-3 py-3 text-right text-xs font-semibold tabular-nums text-slate-900 ${
                monthKey === currentMonth
                  ? "bg-blue-50/80"
                  : "border-l border-slate-100"
              }`}
            >
              {formatHours(
                total,
              )}
            </td>
          );
        },
      )}
    </tr>
  );
}

function Header({
  children,
  align = "left",
  className = "",
}: {
  children:
    React.ReactNode;

  align?: "left" | "right";

  className?: string;
}) {
  return (
    <th
      className={`border-b border-slate-200 px-3 py-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500 first:px-5 ${className} ${
        align === "right"
          ? "text-right"
          : "text-left"
      }`}
    >
      {children}
    </th>
  );
}