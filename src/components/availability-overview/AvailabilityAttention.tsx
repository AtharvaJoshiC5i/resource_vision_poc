import { useMemo, useState } from "react";

import { AlertTriangle } from "lucide-react";

import type { AvailabilityAttentionItem } from "../../types/availabilityAttention";

import { getAvailabilityAttentionMonthSummaries } from "../../services/availabilityAttentionService";

import { formatHours, formatMonth } from "../../utils/formatters";

import { Card } from "../ui/Card";

import { AvailabilityAttentionMonthModal } from "./AvailabilityAttentionMonthModal";

interface AvailabilityAttentionProps {
  items: AvailabilityAttentionItem[];
}

export function AvailabilityAttention({ items }: AvailabilityAttentionProps) {
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(
    null,
  );

  const summaries = useMemo(
    () => getAvailabilityAttentionMonthSummaries(items),
    [items],
  );

  return (
    <Card padding={false}>
      <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-amber-100 bg-amber-50 text-amber-600">
          <AlertTriangle
            className="size-4"
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-900">Attention</h2>

          <p className="mt-1 text-xs text-slate-500">
            Capacity reductions and allocation risks by month within the
            planning horizon.
          </p>
        </div>
      </div>

      {summaries.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm font-medium text-slate-700">
            No availability risks
          </p>

          <p className="mt-1 text-xs text-slate-500">
            No over-allocation or capacity reductions require attention in this
            planning horizon.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
          {summaries.map((summary) => (
            <button
              key={summary.monthKey}
              type="button"
              onClick={() => setSelectedMonthKey(summary.monthKey)}
              aria-label={`View availability risks in ${formatMonth(summary.monthKey)}`}
              className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50/40 px-4 py-4 text-left outline-none transition-colors hover:border-amber-200 hover:bg-amber-50/30 focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-slate-900">
                  {formatMonth(summary.monthKey)}
                </p>

                <span className="text-[11px] text-slate-400">Review</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Metric
                  value={summary.resourcesAffected.toLocaleString("en-US")}
                  label="Resources affected"
                />

                <Metric
                  value={
                    summary.lostCapacityHours > 0
                      ? formatHours(summary.lostCapacityHours)
                      : "—"
                  }
                  label="Capacity lost"
                  emphasis={summary.lostCapacityHours > 0}
                />

                <Metric
                  value={(
                    summary.becomingFullyAllocatedCount +
                    summary.overAllocatedCount +
                    summary.capacityReductionCount
                  ).toLocaleString("en-US")}
                  label="Risk signals"
                />
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedMonthKey !== null && (
        <AvailabilityAttentionMonthModal
          monthKey={selectedMonthKey}
          items={items}
          onClose={() => setSelectedMonthKey(null)}
        />
      )}

      <div className="border-t border-slate-100 bg-slate-50/40 px-5 py-3">
        <p className="text-[11px] leading-5 text-slate-500">
          Click a month to see who is over-allocated, becoming fully booked, or
          losing available hours. Risk signals count individual issues (one
          person may appear in more than one category).
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
          emphasis ? "text-amber-700" : "text-slate-900"
        }`}
      >
        {value}
      </p>

      <p className="mt-1 text-[11px] leading-4 text-slate-500">{label}</p>
    </div>
  );
}
