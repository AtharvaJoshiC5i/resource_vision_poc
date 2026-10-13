import { useState } from "react";

import { ArrowUpRight } from "lucide-react";

import type { UpcomingAvailabilityMonthSummary } from "../../types/availabilityAttention";

import type {
  AvailabilityTransition,
  EmployeeMonthAvailability,
} from "../../types/domain";

import { formatHours, formatMonth } from "../../utils/formatters";

import { Card } from "../ui/Card";

import { UpcomingAvailabilityMonthModal } from "./UpcomingAvailabilityMonthModal";

interface UpcomingAvailabilityProps {
  summaries: UpcomingAvailabilityMonthSummary[];
  transitions: AvailabilityTransition[];
  records: EmployeeMonthAvailability[];
}

export function UpcomingAvailability({
  summaries,
  transitions,
  records,
}: UpcomingAvailabilityProps) {
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(
    null,
  );
  return (
    <Card padding={false}>
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600">
            <ArrowUpRight
              className="size-4"
              strokeWidth={1.8}
              aria-hidden="true"
            />
          </div>

          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900">
              Upcoming Availability
            </h2>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              When resources gain capacity or become fully available.
            </p>
          </div>
        </div>
      </div>

      {summaries.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm font-medium text-slate-700">
            No upcoming availability
          </p>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            No positive capacity changes were identified within this planning
            horizon.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
          {summaries.map((summary) => (
            <button
              key={summary.monthKey}
              type="button"
              onClick={() => setSelectedMonthKey(summary.monthKey)}
              aria-label={`View employees gaining capacity in ${formatMonth(summary.monthKey)}`}
              className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50/40 px-4 py-4 text-left outline-none transition-colors hover:border-blue-200 hover:bg-blue-50/30 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-slate-900">
                  {formatMonth(summary.monthKey)}
                </p>

                <span className="text-[11px] text-slate-400">Expected</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Metric
                  value={summary.resourcesGainingCapacity.toLocaleString(
                    "en-US",
                  )}
                  label="Gaining capacity"
                />

                <Metric
                  value={`+${formatHours(summary.additionalAvailableHours)}`}
                  label="Additional hours"
                  emphasis
                />

                <Metric
                  value={summary.resourcesBecomingFullyAvailable.toLocaleString(
                    "en-US",
                  )}
                  label="Becoming fully available"
                />
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedMonthKey !== null && (
        <UpcomingAvailabilityMonthModal
          monthKey={selectedMonthKey}
          transitions={transitions}
          monthRecords={records}
          onClose={() => setSelectedMonthKey(null)}
        />
      )}

      <div className="border-t border-slate-100 bg-slate-50/40 px-5 py-3">
        <p className="text-[11px] leading-5 text-slate-500">
          Gaining capacity does not necessarily mean becoming fully available. A
          resource may still have allocations on other projects.
        </p>
      </div>
    </Card>
  );
}

function Metric({
  value,
  label,
  emphasis = false,
}: {
  value: string;
  label: string;
  emphasis?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p
        className={`text-base font-semibold tabular-nums ${
          emphasis ? "text-blue-700" : "text-slate-900"
        }`}
      >
        {value}
      </p>

      <p className="mt-1 text-[11px] leading-4 text-slate-500">{label}</p>
    </div>
  );
}
