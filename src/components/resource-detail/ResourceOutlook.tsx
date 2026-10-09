import type { ResourceMonthlyRecord } from "../../types/resourceMonthly";

import {
  formatHours,
  formatMonthShort,
  formatPercentage,
} from "../../utils/formatters";

import { RESOURCE_STATUS_PRESENTATION } from "../../types/resourceDetail";

import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";

const OUTLOOK_MONTHS = ["2026-09", "2026-10", "2026-11", "2026-12"];

interface ResourceOutlookProps {
  records: ResourceMonthlyRecord[];
}

export function ResourceOutlook({ records }: ResourceOutlookProps) {
  const lookup = new Map(records.map((record) => [record.month_key, record]));

  return (
    <Card>
      <div>
        <h2 className="text-base font-semibold text-slate-900">
          Availability Outlook
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Current and future planned availability through December.
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {OUTLOOK_MONTHS.map((monthKey) => {
          const record = lookup.get(monthKey);

          if (record === undefined) {
            return (
              <div
                key={monthKey}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {formatMonthShort(monthKey)}
                </p>

                <p className="mt-3 text-xl font-semibold text-slate-300">—</p>

                <p className="mt-1 text-xs text-slate-400">Not applicable</p>
              </div>
            );
          }

          const status =
            RESOURCE_STATUS_PRESENTATION[record.availability_status];

          const negative = record.available_capacity < 0;

          return (
            <div
              key={monthKey}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {formatMonthShort(monthKey)}
                </p>

                <Badge variant={status.variant}>{status.label}</Badge>
              </div>

              <p
                className={`mt-4 text-2xl font-semibold tracking-tight ${
                  negative ? "text-red-700" : "text-slate-900"
                }`}
              >
                {formatPercentage(record.availability_percentage)}
              </p>

              <p
                className={`mt-1 text-sm ${
                  negative ? "text-red-600" : "text-slate-500"
                }`}
              >
                {formatHours(record.available_capacity)} available
              </p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
