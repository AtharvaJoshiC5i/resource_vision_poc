import {
  ArrowUpRight,
} from "lucide-react";

import {
  Link,
} from "react-router-dom";

import type {
  ProjectResourceAllocationRow,
} from "../../types/projectAvailability";

import { getCurrentMonthKey } from "../../services/monthService";

import {
  formatHours,
  formatMonthShort,
} from "../../utils/formatters";

import {
  Card,
} from "../ui/Card";

interface ProjectResourceAllocationTableProps {
  rows:
    ProjectResourceAllocationRow[];

  monthKeys: string[];
}

export function ProjectResourceAllocationTable({
  rows,
  monthKeys,
}: ProjectResourceAllocationTableProps) {
  const currentMonth = getCurrentMonthKey();

  return (
    <Card padding={false}>
      <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Assigned Resources
          </h2>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            Month cells show hours allocated to this project.
          </p>
        </div>

        <p className="text-[10px] text-slate-400">
          Secondary text = overall employee availability
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm font-medium text-slate-700">
            No resources currently assigned
          </p>

          <p className="mt-1 text-xs text-slate-500">
            This project has no employee allocations in the visible planning horizon.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] table-fixed text-sm">
            <colgroup>
              <col className="w-[220px]" />

              <col className="w-[180px]" />

              <col className="w-[72px]" />

              {monthKeys.map(
                (monthKey) => (
                  <col
                    key={
                      monthKey
                    }
                    className="w-[120px]"
                  />
                ),
              )}
            </colgroup>

            <thead className="bg-slate-50">
              <tr>
                <Header>
                  Resource
                </Header>

                <Header>
                  Capability
                </Header>

                <Header>
                  Grade
                </Header>

                {monthKeys.map(
                  (monthKey) => (
                    <Header
                      key={
                        monthKey
                      }
                      align="center"
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
              {rows.map(
                (row) => (
                  <tr
                    key={
                      row.employeeId
                    }
                    className="hover:bg-slate-50/70"
                  >
                    <td className="px-5 py-3.5">
                      <Link
                        to={`/resources/${encodeURIComponent(
                          row.employeeId,
                        )}`}
                        className="group inline-flex max-w-full items-center gap-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                      >
                        <span className="truncate text-xs font-semibold text-slate-900 group-hover:text-blue-700">
                          {
                            row.employeeName
                          }
                        </span>

                        <ArrowUpRight
                          className="size-3.5 shrink-0 text-slate-300 group-hover:text-blue-600"
                          aria-hidden="true"
                        />
                      </Link>

                      <p className="mt-1 truncate text-[10px] text-slate-400">
                        {
                          row.employeeId
                        }
                        {" · "}
                        {
                          row.location
                        }
                      </p>
                    </td>

                    <td className="px-4 py-3.5">
                      <p className="truncate text-xs font-medium text-slate-700">
                        {
                          row.primaryCapability
                        }
                      </p>

                      {row.secondaryCapability.trim() !==
                        "" && (
                        <p className="mt-0.5 truncate text-[10px] text-slate-400">
                          {
                            row.secondaryCapability
                          }
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-xs font-medium text-slate-600">
                      {row.grade}
                    </td>

                    {monthKeys.map(
                      (monthKey) => {
                        const allocation =
                          row.months.find(
                            (month) =>
                              month.monthKey ===
                              monthKey,
                          );

                        const projectHours =
                          allocation
                            ?.allocatedHours ??
                          0;

                        const overall =
                          row.overallAvailability[
                            monthKey
                          ];

                        return (
                          <td
                            key={
                              monthKey
                            }
                            className={`px-2 py-2.5 text-center ${
                              monthKey === currentMonth
                                ? "bg-blue-50/70"
                                : ""
                            }`}
                          >
                            {projectHours <=
                            0 ? (
                              <div className="flex h-[54px] flex-col items-center justify-center rounded-lg border border-slate-100 bg-slate-50/50">
                                <span className="text-xs font-medium text-slate-300">
                                  —
                                </span>
                              </div>
                            ) : (
                              <div
                                title={
                                  overall ===
                                  null
                                    ? `Project allocation: ${formatHours(
                                        projectHours,
                                      )}. Employee not in workforce for this month.`
                                    : `Project allocation: ${formatHours(
                                        projectHours,
                                      )}. Overall employee availability: ${formatHours(
                                        overall.availableHours,
                                      )}.`
                                }
                                className="flex h-[54px] flex-col items-center justify-center rounded-lg border border-blue-100 bg-blue-50/40"
                              >
                                <span className="text-[13px] font-semibold tabular-nums text-slate-900">
                                  {formatHours(
                                    projectHours,
                                  )}
                                </span>

                                {overall !==
                                  null && (
                                  <span
                                    className={`mt-1 text-[9px] font-medium ${
                                      overall.availableHours <
                                      0
                                        ? "text-red-600"
                                        : "text-slate-400"
                                    }`}
                                  >
                                    {formatHours(
                                      overall.availableHours,
                                    )}{" "}
                                    available
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      },
                    )}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}

      {rows.length >
        0 && (
        <div className="border-t border-slate-100 bg-slate-50/40 px-5 py-3">
          <p className="text-[10px] leading-4 text-slate-400">
            Primary value = hours allocated to this project. Overall availability is calculated separately by the Availability Engine across all employee commitments.
          </p>
        </div>
      )}
    </Card>
  );
}

function Header({
  children,
  align = "left",
  className = "",
}: {
  children:
    React.ReactNode;

  align?: "left" | "center";

  className?: string;
}) {
  return (
    <th
      className={`border-b border-slate-200 px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500 first:px-5 ${className} ${
        align === "center"
          ? "text-center"
          : "text-left"
      }`}
    >
      {children}
    </th>
  );
}