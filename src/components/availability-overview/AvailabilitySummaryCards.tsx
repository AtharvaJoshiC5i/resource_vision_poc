import {
  AlertTriangle,
  BriefcaseBusiness,
  Clock3,
  Users,
  UserRoundCheck,
} from "lucide-react";

import type {
  LucideIcon,
} from "lucide-react";

import type {
  MonthlyAvailabilitySummary,
} from "../../types/domain";

import {
  formatHours,
} from "../../utils/formatters";

interface AvailabilitySummaryCardsProps {
  summary:
    MonthlyAvailabilitySummary;
}

interface SummaryCardProps {
  label: string;

  value: string;

  context: string;

  icon: LucideIcon;

  variant?:
    | "default"
    | "positive"
    | "attention";
}

function SummaryCard({
  label,
  value,
  context,
  icon: Icon,
  variant = "default",
}: SummaryCardProps) {
  const isPositive =
    variant === "positive";

  const isAttention =
    variant === "attention";

  return (
    <div
      className={`group relative min-w-0 overflow-hidden rounded-xl border bg-white px-4 py-4 transition-colors ${
        isAttention
          ? "border-red-200"
          : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            {label}
          </p>

          <p
            className={`mt-3 truncate text-[22px] font-semibold leading-none tracking-tight tabular-nums ${
              isAttention
                ? "text-red-700"
                : "text-slate-950"
            }`}
          >
            {value}
          </p>
        </div>

        <div
          className={`flex size-8 shrink-0 items-center justify-center rounded-lg border ${
            isAttention
              ? "border-red-100 bg-red-50 text-red-600"
              : isPositive
                ? "border-emerald-100 bg-emerald-50 text-emerald-600"
                : "border-slate-200 bg-slate-50 text-slate-500"
          }`}
        >
          <Icon
            className="size-4"
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </div>
      </div>

      <div className="mt-3 flex min-h-5 items-end">
        <p
          className={`truncate text-[11px] leading-4 ${
            isAttention
              ? "text-red-500"
              : "text-slate-500"
          }`}
        >
          {context}
        </p>
      </div>

      <div
        className={`absolute inset-x-0 bottom-0 h-0.5 ${
          isAttention
            ? "bg-red-400"
            : isPositive
              ? "bg-emerald-400"
              : "bg-slate-200"
        }`}
        aria-hidden="true"
      />
    </div>
  );
}

export function AvailabilitySummaryCards({
  summary,
}: AvailabilitySummaryCardsProps) {
  const totalResources =
    summary.totalResources;

  const capacityPercentage =
    totalResources === 0
      ? 0
      : Math.round(
          (summary.resourcesWithCapacity /
            totalResources) *
            100,
        );

  const fullyAllocatedPercentage =
    totalResources === 0
      ? 0
      : Math.round(
          (summary.fullyAllocatedResources /
            totalResources) *
            100,
        );

  const hasOverAllocation =
    summary.overAllocatedResources >
    0;

  return (
    <section
      aria-label="Availability summary"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
    >
      <SummaryCard
        label="Total Resources"
        value={totalResources.toLocaleString(
          "en-US",
        )}
        context="Eligible workforce"
        icon={Users}
      />

      <SummaryCard
        label="With Capacity"
        value={summary.resourcesWithCapacity.toLocaleString(
          "en-US",
        )}
        context={`${capacityPercentage}% of workforce`}
        icon={UserRoundCheck}
        variant="positive"
      />

      <SummaryCard
        label="Fully Allocated"
        value={summary.fullyAllocatedResources.toLocaleString(
          "en-US",
        )}
        context={`${fullyAllocatedPercentage}% of workforce`}
        icon={BriefcaseBusiness}
      />

      <SummaryCard
        label="Available Hours"
        value={formatHours(
          summary.totalAvailableHours,
        )}
        context="Usable positive capacity"
        icon={Clock3}
        variant="positive"
      />

      <SummaryCard
        label="Over-Allocated"
        value={summary.overAllocatedResources.toLocaleString(
          "en-US",
        )}
        context={
          hasOverAllocation
            ? "Requires attention"
            : "No capacity conflicts"
        }
        icon={AlertTriangle}
        variant={
          hasOverAllocation
            ? "attention"
            : "default"
        }
      />
    </section>
  );
}