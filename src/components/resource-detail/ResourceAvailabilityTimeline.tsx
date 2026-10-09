import type {
  EmployeeMonthAvailability,
} from "../../types/domain";

import { getCurrentMonthKey } from "../../services/monthService";

import {
  formatHours,
  formatMonthShort,
  formatPercentage,
} from "../../utils/formatters";

import {
  Card,
} from "../ui/Card";

interface ResourceAvailabilityTimelineProps {
  records:
    EmployeeMonthAvailability[];

  monthKeys: string[];

  selectedMonth: string;

  onSelectMonth: (
    monthKey: string,
  ) => void;
}

function getStatusLabel(
  status:
    EmployeeMonthAvailability["status"],
): string {
  switch (status) {
    case "AVAILABLE":
      return "Available";

    case "PARTIALLY_AVAILABLE":
      return "Partial";

    case "FULLY_ALLOCATED":
      return "Allocated";

    case "OVER_ALLOCATED":
      return "Over";
  }
}

export function ResourceAvailabilityTimeline({
  records,
  monthKeys,
  selectedMonth,
  onSelectMonth,
}: ResourceAvailabilityTimelineProps) {
  const currentMonth = getCurrentMonthKey();
  const lookup =
    new Map(
      records.map(
        (record) => [
          record.monthKey,
          record,
        ],
      ),
    );

  return (
    <Card padding={false}>
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Monthly Availability
          </h2>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            Capacity, allocation and available hours across the planning horizon.
          </p>
        </div>

        <p className="shrink-0 text-[10px] text-slate-400">
          Blocked capacity: 0h in Availability V1
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] table-fixed text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="w-36 border-b border-r border-slate-200 px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Metric
              </th>

              {monthKeys.map(
                (monthKey) => {
                  const current = monthKey === currentMonth;

                  return (
                    <th
                      key={monthKey}
                      className={`border-b px-3 py-3 text-center ${
                        current
                          ? "border-blue-200 bg-blue-100"
                          : "border-slate-200"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          onSelectMonth(
                            monthKey,
                          )
                        }
                        className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 ${
                          current
                            ? "bg-blue-100 text-blue-800"
                            : selectedMonth === monthKey
                              ? "bg-blue-50 text-blue-700"
                              : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {formatMonthShort(
                          monthKey,
                        )}
                      </button>
                    </th>
                  );
                },
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            <MetricRow
              label="Capacity"
              currentMonth={currentMonth}
              monthKeys={monthKeys}
              lookup={lookup}
              getValue={(record) =>
                formatHours(
                  record.totalCapacityHours,
                )
              }
            />

            <MetricRow
              label="Allocated"
              currentMonth={currentMonth}
              monthKeys={monthKeys}
              lookup={lookup}
              getValue={(record) =>
                formatHours(
                  record.allocatedHours,
                )
              }
            />

            <MetricRow
              label="Available"
              currentMonth={currentMonth}
              monthKeys={monthKeys}
              lookup={lookup}
              getValue={(record) =>
                formatHours(
                  record.availableHours,
                )
              }
              highlightNegative
              strong
            />

            <MetricRow
              label="Availability"
              currentMonth={currentMonth}
              monthKeys={monthKeys}
              lookup={lookup}
              getValue={(record) =>
                formatPercentage(
                  record.availabilityPercentage,
                )
              }
              highlightNegative
            />

            <MetricRow
              label="Status"
              currentMonth={currentMonth}
              monthKeys={monthKeys}
              lookup={lookup}
              getValue={(record) =>
                getStatusLabel(
                  record.status,
                )
              }
            />
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function MetricRow({
  label,
  currentMonth,
  monthKeys,
  lookup,
  getValue,
  highlightNegative = false,
  strong = false,
}: {
  label: string;

  currentMonth: string;

  monthKeys: string[];

  lookup: Map<
    string,
    EmployeeMonthAvailability
  >;

  getValue: (
    record:
      EmployeeMonthAvailability,
  ) => string;

  highlightNegative?: boolean;

  strong?: boolean;
}) {
  return (
    <tr>
      <th className="border-r border-slate-100 bg-slate-50/40 px-4 py-3 text-left text-xs font-medium text-slate-500">
        {label}
      </th>

      {monthKeys.map(
        (monthKey) => {
          const record =
            lookup.get(
              monthKey,
            );

          return (
            <td
              key={monthKey}
              className={`px-3 py-3 text-center ${
                monthKey === currentMonth ? "bg-blue-50/70" : ""
              }`}
            >
              {record ===
              undefined ? (
                <div>
                  <span className="text-xs font-medium text-slate-300">
                    —
                  </span>

                  <p className="mt-0.5 text-[9px] text-slate-400">
                    Not in workforce
                  </p>
                </div>
              ) : (
                <span
                  className={`text-xs tabular-nums ${
                    highlightNegative &&
                    record.availableHours <
                      0
                      ? "font-semibold text-red-700"
                      : strong
                        ? "font-semibold text-slate-900"
                        : "font-medium text-slate-700"
                  }`}
                >
                  {getValue(
                    record,
                  )}
                </span>
              )}
            </td>
          );
        },
      )}
    </tr>
  );
}