import type {
  EmployeeMonthAvailability,
  MonthlyAvailabilitySummary,
} from "../../types/domain";

import { formatHours, formatLongMonth } from "../../utils/formatters";

import { Card } from "../ui/Card";

interface CapacitySummaryProps {
  summary: MonthlyAvailabilitySummary;

  records: EmployeeMonthAvailability[];
}

export function CapacitySummary({ summary, records }: CapacitySummaryProps) {
  const overAllocatedHours = records.reduce(
    (total, record) =>
      record.availableHours < 0
        ? total + Math.abs(record.availableHours)
        : total,
    0,
  );

  return (
    <Card>
      <div>
        <h2 className="text-sm font-semibold text-slate-900">
          Capacity Composition
        </h2>

        <p className="mt-1 text-xs text-slate-500">
          {formatLongMonth(summary.monthKey)}
        </p>
      </div>

      <dl className="mt-5 divide-y divide-slate-100">
        <CapacityRow
          label="Total Capacity"
          value={formatHours(summary.totalCapacityHours)}
        />

        <CapacityRow
          label="Allocated"
          value={formatHours(summary.totalAllocatedHours)}
        />

        <CapacityRow
          label="Available"
          value={formatHours(summary.totalAvailableHours)}
        />

        <CapacityRow
          label="Over-allocation"
          value={
            overAllocatedHours > 0 ? formatHours(overAllocatedHours) : "0 hrs"
          }
          supportingText={
            summary.overAllocatedResources > 0
              ? `${summary.overAllocatedResources} affected ${
                  summary.overAllocatedResources === 1
                    ? "resource"
                    : "resources"
                }`
              : "No affected resources"
          }
          attention={overAllocatedHours > 0}
        />
      </dl>

      <p className="mt-4 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
        Available capacity represents positive usable hours. Over-allocation is
        shown separately and does not reduce another resource's available
        capacity.
      </p>
    </Card>
  );
}

function CapacityRow({
  label,
  value,
  supportingText,
  attention = false,
}: {
  label: string;
  value: string;
  supportingText?: string;
  attention?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <dt>
        <p className="text-xs font-medium text-slate-500">{label}</p>

        {supportingText !== undefined && (
          <p className="mt-0.5 text-[11px] text-slate-400">{supportingText}</p>
        )}
      </dt>

      <dd
        className={`text-sm font-semibold ${
          attention ? "text-red-700" : "text-slate-900"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
