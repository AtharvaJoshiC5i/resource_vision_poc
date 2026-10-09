import type { ResourceProjectAllocation } from "../../types/resourceDetail";

import { formatHours, formatMonthShort } from "../../utils/formatters";

import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";

import { BriefcaseBusiness } from "lucide-react";

const PLANNING_MONTHS = ["2026-09", "2026-10", "2026-11", "2026-12"];

interface AllocationSectionProps {
  allocations: ResourceProjectAllocation[];
}

export function AllocationSection({ allocations }: AllocationSectionProps) {
  return (
    <Card padding={false}>
      <div className="border-b border-slate-200 p-5">
        <h2 className="text-base font-semibold text-slate-900">
          Current & Future Allocations
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Project Track allocations that explain planned utilization from
          September through December.
        </p>
      </div>

      {allocations.length === 0 ? (
        <EmptyState
          icon={BriefcaseBusiness}
          title="No planned allocations"
          description="No current or future Project Track allocations were found for this resource."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th
                  scope="col"
                  className="min-w-64 px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Project
                </th>

                <th
                  scope="col"
                  className="min-w-32 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Status
                </th>

                {PLANNING_MONTHS.map((monthKey) => (
                  <th
                    key={monthKey}
                    scope="col"
                    className="min-w-24 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    {formatMonthShort(monthKey)}
                  </th>
                ))}

                <th
                  scope="col"
                  className="min-w-28 px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Total
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 bg-white">
              {allocations.map((allocation) => {
                const lookup = new Map(
                  allocation.months.map((month) => [
                    month.monthKey,
                    month.effortHours,
                  ]),
                );

                return (
                  <tr
                    key={`${allocation.projectId}-${allocation.proposalNumber}`}
                    className="hover:bg-slate-50"
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-slate-900">
                        {allocation.projectName}
                      </p>

                      <p className="mt-0.5 text-xs text-slate-500">
                        {allocation.proposalNumber || allocation.projectId}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {allocation.contractType}
                      </p>
                    </td>

                    <td className="px-4 py-3.5 text-slate-600">
                      {allocation.projectStatus}
                    </td>

                    {PLANNING_MONTHS.map((monthKey) => {
                      const effort = lookup.get(monthKey);

                      return (
                        <td
                          key={monthKey}
                          className="px-4 py-3.5 text-right text-slate-700"
                        >
                          {effort === undefined ? "—" : formatHours(effort)}
                        </td>
                      );
                    })}

                    <td className="px-5 py-3.5 text-right font-medium text-slate-900">
                      {formatHours(allocation.totalEffortHours)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
