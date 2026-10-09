import { CircleGauge, TriangleAlert, Users, UsersRound } from "lucide-react";

import type { ResourceSummaryData } from "../../types/resources";

import { formatHours, formatPercentage } from "../../utils/formatters";

interface ResourceSummaryProps {
  data: ResourceSummaryData;
}

interface SummaryCardProps {
  label: string;
  value: string;
  supportingText?: string;
  icon: typeof Users;
  warning?: boolean;
}

function SummaryCard({
  label,
  value,
  supportingText,
  icon: Icon,
  warning = false,
}: SummaryCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>

          <p
            className={`mt-2 text-2xl font-semibold tracking-tight ${
              warning ? "text-red-700" : "text-slate-900"
            }`}
          >
            {value}
          </p>

          {supportingText !== undefined && (
            <p className="mt-1 text-xs text-slate-500">{supportingText}</p>
          )}
        </div>

        <div
          className={`flex size-9 shrink-0 items-center justify-center rounded-xl border ${
            warning
              ? "border-red-200 bg-red-50"
              : "border-slate-200 bg-slate-50"
          }`}
        >
          <Icon
            className={`size-4.5 ${
              warning ? "text-red-600" : "text-slate-500"
            }`}
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  );
}

export function ResourceSummary({ data }: ResourceSummaryProps) {
  return (
    <section
      aria-label="Resource summary"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <SummaryCard
        label="Resources"
        value={data.resourceCount.toLocaleString("en-US")}
        supportingText="Filtered active resources"
        icon={Users}
      />

      <SummaryCard
        label="Available Resources"
        value={data.availableResourceCount.toLocaleString("en-US")}
        supportingText={`of ${data.resourceCount} resources`}
        icon={UsersRound}
      />

      <SummaryCard
        label="Available Capacity"
        value={formatHours(data.availableCapacity)}
        supportingText={`${formatPercentage(
          data.availabilityPercentage,
        )} availability`}
        icon={CircleGauge}
        warning={data.availableCapacity < 0}
      />

      <SummaryCard
        label="Over Allocated"
        value={data.overAllocatedCount.toLocaleString("en-US")}
        supportingText="Resource records"
        icon={TriangleAlert}
        warning={data.overAllocatedCount > 0}
      />
    </section>
  );
}
