import type { ReactNode } from "react";

import type { EmployeeMonthAvailability } from "../../types/domain";

import { getResourceReleaseForecast } from "../../services/resourceReleaseService";

import { formatHours, formatMonth } from "../../utils/formatters";

import { Card } from "../ui/Card";

interface ResourceReleaseForecastProps {
  records: EmployeeMonthAvailability[];
  focusMonth: string;
}

export function ResourceReleaseForecast({
  records,
  focusMonth,
}: ResourceReleaseForecastProps) {
  const forecast = getResourceReleaseForecast(records).filter(
    (row) => row.monthKey > focusMonth,
  );

  return (
    <Card padding={false}>
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-900">
          Resource Release Forecast
        </h2>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          Month-by-month capacity gains and reductions in planned project
          commitments.
        </p>
      </div>

      {forecast.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm font-medium text-slate-700">
            No future months available
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Adjust the planning horizon to view future resource releases.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] border-collapse text-sm">
            <thead className="bg-slate-50">
              <tr>
                <Header>Month</Header>
                <Header align="right">Resources Gaining Capacity</Header>
                <Header align="right">Additional Available Hours</Header>
                <Header align="right">Resources Reducing Allocations</Header>
                <Header align="right">Allocation Reduction</Header>
                <Header align="right">Partial Release</Header>
                <Header align="right">Full Release</Header>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {forecast.map((row) => (
                <tr
                  key={row.monthKey}
                  className="transition-colors hover:bg-slate-50/70"
                >
                  <td className="whitespace-nowrap px-5 py-3.5 text-xs font-semibold text-slate-900">
                    {formatMonth(row.monthKey)}
                  </td>

                  <NumberCell value={row.resourcesReleasing} />

                  <td className="px-4 py-3.5 text-right text-xs font-semibold tabular-nums text-blue-700">
                    {row.capacityReleasedHours > 0
                      ? `+${formatHours(row.capacityReleasedHours)}`
                      : "—"}
                  </td>

                  <NumberCell value={row.resourcesWithReducedAllocations} />

                  <td className="px-4 py-3.5 text-right text-xs font-medium tabular-nums text-slate-800">
                    {row.allocationReductionHours > 0
                      ? formatHours(row.allocationReductionHours)
                      : "—"}
                  </td>

                  <NumberCell value={row.partialReleaseCount} />

                  <NumberCell value={row.fullReleaseCount} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-3">
        <p className="text-[11px] leading-5 text-slate-500">
          Additional available hours are positive month-to-month changes in
          capacity after allocations. Allocation reductions are calculated
          independently, including months when overall availability decreases.
          Partial and full release classifications refer to increases in
          available capacity. Values reflect the active resource filters.
        </p>
      </div>
    </Card>
  );
}

function Header({
  children,
  align = "left",
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={`border-b border-slate-200 px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500 first:px-5 ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function NumberCell({ value }: { value: number }) {
  return (
    <td className="px-4 py-3.5 text-right text-xs font-medium tabular-nums text-slate-700">
      {value.toLocaleString("en-US")}
    </td>
  );
}
