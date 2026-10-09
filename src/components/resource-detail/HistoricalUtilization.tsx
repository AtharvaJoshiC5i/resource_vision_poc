import { History } from "lucide-react";

import type { HistoricalActivityRow } from "../../types/resourceDetail";

import { formatHours, formatMonth } from "../../utils/formatters";

import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";

interface HistoricalUtilizationProps {
  activity: HistoricalActivityRow[];
}

export function HistoricalUtilization({
  activity,
}: HistoricalUtilizationProps) {
  return (
    <Card padding={false}>
      <div className="border-b border-slate-200 p-5">
        <h2 className="text-base font-semibold text-slate-900">
          Historical Utilization
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Famstack actual effort that explains historical utilization.
        </p>
      </div>

      {activity.length === 0 ? (
        <EmptyState
          icon={History}
          title="No historical activity"
          description="No historical Famstack activity was found for this resource."
        />
      ) : (
        <div className="max-h-96 overflow-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="sticky top-0 bg-slate-50">
              <tr>
                <th
                  scope="col"
                  className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Month
                </th>

                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Project
                </th>

                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Work Category
                </th>

                <th
                  scope="col"
                  className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Actual Effort
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 bg-white">
              {activity.map((row, index) => (
                <tr key={`${row.monthKey}-${row.projectId}-${index}`}>
                  <td className="whitespace-nowrap px-5 py-3 text-slate-700">
                    {formatMonth(row.monthKey)}
                  </td>

                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">
                      {row.projectName || "Non-project activity"}
                    </p>

                    {row.projectId !== "" && (
                      <p className="mt-0.5 text-xs text-slate-400">
                        {row.projectId}
                      </p>
                    )}
                  </td>

                  <td className="px-4 py-3 text-slate-600">
                    {row.workCategory}
                  </td>

                  <td className="whitespace-nowrap px-5 py-3 text-right font-medium text-slate-800">
                    {formatHours(row.actualEffortHours)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
