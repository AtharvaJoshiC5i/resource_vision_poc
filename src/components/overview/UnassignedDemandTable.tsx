import { ClipboardList } from "lucide-react";

import type { UnassignedDemandRecord } from "../../types/demand";

import { formatHours } from "../../utils/formatters";

import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";

interface UnassignedDemandTableProps {
  data: UnassignedDemandRecord[];
}

export function UnassignedDemandTable({
  data,
}: UnassignedDemandTableProps) {
  return (
    <Card padding={false}>
      <div className="border-b border-slate-200 p-5">
        <h2 className="text-base font-semibold text-slate-900">
          Unassigned Demand
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Project demand that has not yet been assigned to a named
          resource.
        </p>
      </div>

      {data.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No unassigned demand"
          description="No unassigned demand for this month."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th
                  scope="col"
                  className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Project / Proposal
                </th>

                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Capability
                </th>

                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Grade
                </th>

                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Location
                </th>

                <th
                  scope="col"
                  className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Demand Hours
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 bg-white">
              {data.map((demand, index) => (
                <tr
                  key={`${demand.project_id}-${demand.month_key}-${index}`}
                  className="hover:bg-slate-50"
                >
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-slate-900">
                      {demand.project_name}
                    </p>

                    <p className="mt-0.5 text-xs text-slate-500">
                      {demand.proposal_number || demand.project_id}
                    </p>
                  </td>

                  <td className="px-4 py-3.5 text-slate-700">
                    {demand.primary_capability}
                  </td>

                  <td className="px-4 py-3.5 text-slate-700">
                    {demand.grade}
                  </td>

                  <td className="px-4 py-3.5 text-slate-700">
                    {demand.location}
                  </td>

                  <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-slate-900">
                    {formatHours(demand.effort_hours)}
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