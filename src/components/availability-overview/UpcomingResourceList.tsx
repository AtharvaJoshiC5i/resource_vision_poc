import {
  ArrowUpRight,
} from "lucide-react";

import {
  Link,
} from "react-router-dom";

import type {
  AvailabilityTransition,
} from "../../types/domain";

import {
  formatHours,
  formatMonthShort,
} from "../../utils/formatters";

import {
  Card,
} from "../ui/Card";

interface UpcomingResourceListProps {
  transitions:
    AvailabilityTransition[];

  maxRows?: number;
}

export function UpcomingResourceList({
  transitions,
  maxRows = 8,
}: UpcomingResourceListProps) {
  const positiveTransitions =
    transitions
      .filter(
        (transition) =>
          transition.additionalAvailableHours >
          0,
      )
      .slice(
        0,
        maxRows,
      );

  return (
    <Card padding={false}>
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Resources Gaining Capacity
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Employee-level changes behind upcoming availability.
          </p>
        </div>

        <Link
          to="/resources"
          className="shrink-0 rounded text-xs font-medium text-blue-700 outline-none hover:text-blue-800 focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          View Resources
        </Link>
      </div>

      {positiveTransitions.length ===
      0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-slate-500">
            No resources gain additional capacity within this planning horizon.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50">
              <tr>
                <Header>
                  Resource
                </Header>

                <Header>
                  Transition
                </Header>

                <Header align="right">
                  Prior
                </Header>

                <Header align="right">
                  New
                </Header>

                <Header align="right">
                  Change
                </Header>

                <Header>
                  Outcome
                </Header>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 bg-white">
              {positiveTransitions.map(
                (transition) => (
                  <tr
                    key={`${transition.employeeId}-${transition.fromMonthKey}-${transition.toMonthKey}`}
                    className="hover:bg-slate-50/70"
                  >
                    <td className="px-5 py-3">
                      <Link
                        to={`/resources/${encodeURIComponent(
                          transition.employeeId,
                        )}`}
                        className="group inline-flex items-center gap-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                      >
                        <span className="text-xs font-semibold text-slate-900 group-hover:text-blue-700">
                          {
                            transition.employeeName
                          }
                        </span>

                        <ArrowUpRight
                          className="size-3.5 text-slate-300 group-hover:text-blue-600"
                          aria-hidden="true"
                        />
                      </Link>
                    </td>

                    <td className="px-4 py-3 text-xs text-slate-600">
                      {formatMonthShort(
                        transition.fromMonthKey,
                      )}
                      {" → "}
                      {formatMonthShort(
                        transition.toMonthKey,
                      )}
                    </td>

                    <td className="px-4 py-3 text-right text-xs font-medium tabular-nums text-slate-600">
                      {formatHours(
                        transition.previousAvailableHours,
                      )}
                    </td>

                    <td className="px-4 py-3 text-right text-xs font-semibold tabular-nums text-slate-900">
                      {formatHours(
                        transition.currentAvailableHours,
                      )}
                    </td>

                    <td className="px-4 py-3 text-right text-xs font-semibold tabular-nums text-blue-700">
                      +
                      {formatHours(
                        transition.additionalAvailableHours,
                      )}
                    </td>

                    <td className="px-5 py-3">
                      <span className="text-[10px] font-medium text-slate-600">
                        {transition.transitionTypes.includes(
                          "BECAME_FULLY_AVAILABLE",
                        )
                          ? `Fully available ${formatMonthShort(
                              transition.toMonthKey,
                            )}`
                          : "Partially available"}
                      </span>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function Header({
  children,
  align = "left",
}: {
  children:
    React.ReactNode;

  align?:
    | "left"
    | "right";
}) {
  return (
    <th
      className={`border-b border-slate-200 px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500 first:px-5 last:px-5 ${
        align === "right"
          ? "text-right"
          : "text-left"
      }`}
    >
      {children}
    </th>
  );
}