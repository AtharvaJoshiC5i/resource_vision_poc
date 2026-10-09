import type { DataStatusRow } from "../../types/dataSources";

import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";

interface DataStatusTableProps {
  rows: DataStatusRow[];
}

export function DataStatusTable({ rows }: DataStatusTableProps) {
  return (
    <Card padding={false}>
      <div className="border-b border-slate-200 p-5">
        <h2 className="text-base font-semibold text-slate-900">Data Status</h2>

        <p className="mt-1 text-sm leading-6 text-slate-500">
          Current POC data status and the corresponding production integration
          direction.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th
                scope="col"
                className="min-w-40 px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Source
              </th>

              <th
                scope="col"
                className="min-w-56 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Purpose
              </th>

              <th
                scope="col"
                className="min-w-56 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                POC Data
              </th>

              <th
                scope="col"
                className="min-w-56 px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Production Integration
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((row) => (
              <tr key={row.source}>
                <td className="px-5 py-3.5 font-medium text-slate-900">
                  {row.source}
                </td>

                <td className="px-4 py-3.5 text-slate-600">{row.purpose}</td>

                <td className="px-4 py-3.5">
                  <Badge variant="blue">{row.pocData}</Badge>
                </td>

                <td className="px-5 py-3.5 text-slate-600">
                  {row.productionIntegration}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
