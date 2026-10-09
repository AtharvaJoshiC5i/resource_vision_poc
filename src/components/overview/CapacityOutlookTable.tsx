import { Link } from "react-router-dom";

import { getCurrentMonthKey } from "../../services/monthService";

import {
  PLANNING_MONTHS,
  type CapacityOutlookRow,
} from "../../services/overviewService";

import { formatMonthShort, formatPercentage } from "../../utils/formatters";

import { Card } from "../ui/Card";

interface CapacityOutlookTableProps {
  data: CapacityOutlookRow[];
}

export function CapacityOutlookTable({ data }: CapacityOutlookTableProps) {
  const currentMonth = getCurrentMonthKey();

  return (
    <Card padding={false}>
      <div className="border-b border-slate-200 p-5">
        <h2 className="text-base font-semibold text-slate-900">
          Capacity Outlook
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Planned availability across primary capabilities for September through
          December.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th
                scope="col"
                className="min-w-56 px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Primary Capability
              </th>

              {PLANNING_MONTHS.map((monthKey) => {
                const current = monthKey === currentMonth;

                return (
                  <th
                    key={monthKey}
                    scope="col"
                    className={`min-w-28 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide ${
                      current
                        ? "bg-blue-100 text-blue-800"
                        : "text-slate-500"
                    }`}
                  >
                    {formatMonthShort(monthKey)}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 bg-white">
            {data.map((row) => (
              <tr key={row.primaryCapability} className="hover:bg-slate-50">
                <th
                  scope="row"
                  className="px-5 py-3.5 text-left font-medium text-slate-900"
                >
                  <Link
                    to={`/availability?${new URLSearchParams({
                      primaryCapability: row.primaryCapability,
                    }).toString()}`}
                    className="outline-none hover:text-blue-700 focus-visible:rounded focus-visible:ring-2 focus-visible:ring-blue-600"
                  >
                    {row.primaryCapability}
                  </Link>
                </th>

                {PLANNING_MONTHS.map((monthKey) => {
                  const month = row.months[monthKey];

                  const negative = month.availableCapacity < 0;

                  const query = new URLSearchParams({
                    primaryCapability: row.primaryCapability,
                    month: monthKey,
                  });

                  return (
                    <td
                      key={monthKey}
                      className={`px-4 py-3.5 text-right ${
                        monthKey === currentMonth ? "bg-blue-50" : ""
                      }`}
                    >
                      <Link
                        to={`/availability?${query.toString()}`}
                        className={`inline-flex rounded-lg px-2 py-1 font-medium outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                          negative
                            ? "bg-red-50 text-red-700"
                            : "text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                        }`}
                      >
                        {formatPercentage(month.availabilityPercentage)}
                      </Link>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
