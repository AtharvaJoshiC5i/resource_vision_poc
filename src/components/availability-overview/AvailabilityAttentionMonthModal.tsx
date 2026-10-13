import { useEffect } from "react";

import { ArrowDownRight, ArrowUpRight, X } from "lucide-react";

import { Link } from "react-router-dom";

import type { AvailabilityAttentionItem } from "../../types/availabilityAttention";

import {
  describeAvailabilityAttentionItem,
  partitionAvailabilityAttentionItems,
} from "../../services/availabilityAttentionService";

import {
  formatHours,
  formatLongMonth,
} from "../../utils/formatters";

interface AvailabilityAttentionMonthModalProps {
  monthKey: string;
  items: AvailabilityAttentionItem[];
  onClose: () => void;
}

export function AvailabilityAttentionMonthModal({
  monthKey,
  items,
  onClose,
}: AvailabilityAttentionMonthModalProps) {
  const monthItems = items.filter((item) => item.monthKey === monthKey);

  const {
    overAllocated,
    becomingOverAllocated,
    becomingFullyAllocated,
    capacityReductions,
  } = partitionAvailabilityAttentionItems(monthItems);

  const uniqueResources = new Set(
    monthItems.map((item) => item.employeeId),
  ).size;

  const lostHours = monthItems.reduce((sum, item) => {
    if (item.changeHours !== undefined && item.changeHours < 0) {
      return sum + Math.abs(item.changeHours);
    }

    return sum;
  }, 0);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close attention details"
        className="absolute inset-0 bg-slate-950/40"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="availability-attention-month-title"
        className="relative flex max-h-[min(85vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Attention
            </p>

            <h2
              id="availability-attention-month-title"
              className="mt-1 text-lg font-semibold text-slate-900"
            >
              {formatLongMonth(monthKey)}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {uniqueResources.toLocaleString("en-US")} resources affected
              {lostHours > 0 && (
                <>
                  {" · "}
                  {formatHours(lostHours)} capacity lost vs prior month
                </>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-500 outline-none hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <AttentionSection
            title="Over-allocated"
            description="Resources already booked beyond capacity this month."
            items={overAllocated}
            emptyMessage="No over-allocated resources this month."
          />

          <AttentionSection
            title="Becoming over-allocated"
            description="Resources crossing into over-allocation this month."
            items={becomingOverAllocated}
            emptyMessage="No new over-allocation this month."
            className="mt-8"
          />

          <AttentionSection
            title="Becoming fully allocated"
            description="Resources with no remaining available hours this month."
            items={becomingFullyAllocated}
            emptyMessage="No one becomes fully allocated this month."
            className="mt-8"
          />

          <AttentionSection
            title="Capacity reductions"
            description="Resources losing available hours while still partially free."
            items={capacityReductions}
            emptyMessage="No partial capacity reductions this month."
            className="mt-8"
          />
        </div>

        <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3">
          <p className="text-[11px] leading-5 text-slate-500">
            Month-to-month changes use the prior month in the planning horizon.
            Over-allocation is shown for each month where it applies.
          </p>
        </div>
      </div>
    </div>
  );
}

function AttentionSection({
  title,
  description,
  items,
  emptyMessage,
  className = "",
}: {
  title: string;
  description: string;
  items: AvailabilityAttentionItem[];
  emptyMessage: string;
  className?: string;
}) {
  return (
    <section className={className}>
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-900">
          {title}
          <span className="ml-2 text-sm font-medium text-slate-500">
            ({items.length.toLocaleString("en-US")})
          </span>
        </h3>

        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center text-sm text-slate-500">
          {emptyMessage}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {items.map((item) => (
            <li key={`${item.employeeId}-${item.type}`}>
              <AttentionRow item={item} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AttentionRow({
  item,
}: {
  item: AvailabilityAttentionItem;
}) {
  const showHourTransition =
    item.previousAvailableHours !== undefined &&
    item.type !== "OVER_ALLOCATED";

  return (
    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <Link
          to={`/resources/${encodeURIComponent(item.employeeId)}`}
          className="group inline-flex max-w-full items-center gap-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <span className="truncate text-sm font-semibold text-slate-900 group-hover:text-blue-700">
            {item.employeeName}
          </span>

          <ArrowUpRight
            className="size-3.5 shrink-0 text-slate-300 group-hover:text-blue-600"
            aria-hidden="true"
          />
        </Link>

        <p className="mt-0.5 text-xs text-slate-500">
          {item.primaryCapability}
          {" · "}
          {item.grade}
        </p>
      </div>

      <div className="flex flex-col items-start gap-1 sm:items-end">
        <div className="flex items-center gap-1">
          <ArrowDownRight
            className="size-3 shrink-0 text-amber-600"
            aria-hidden="true"
          />

          <p className="text-xs font-semibold text-slate-700">
            {describeAvailabilityAttentionItem(item)}
          </p>
        </div>

        {showHourTransition && (
          <p className="text-xs tabular-nums text-slate-500">
            {formatHours(item.previousAvailableHours!)}
            {" → "}
            <span className="font-semibold text-slate-900">
              {formatHours(item.currentAvailableHours)}
            </span>
          </p>
        )}

        {item.type === "OVER_ALLOCATED" && (
          <p className="text-xs font-medium tabular-nums text-red-600">
            {formatHours(item.currentAvailableHours)} available
          </p>
        )}
      </div>
    </div>
  );
}
