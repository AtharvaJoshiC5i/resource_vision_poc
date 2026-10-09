import type { AvailabilitySummaryData } from "../../types/availabilityExplorer";

import { formatHours, formatPercentage } from "../../utils/formatters";

interface AvailabilitySummaryProps {
  data: AvailabilitySummaryData;
  allMonths: boolean;
}

export function AvailabilitySummary({
  data,
  allMonths,
}: AvailabilitySummaryProps) {
  const items = [
    {
      label: "Resources",
      value: data.resourceCount.toLocaleString("en-US"),
      detail: allMonths
        ? "unique across displayed months"
        : "active in selected month",
    },
    {
      label: "Total Capacity",
      value: formatHours(data.totalCapacity),
    },
    {
      label: "Utilized",
      value: formatHours(data.utilizedCapacity),
    },
    {
      label: "Available",
      value: formatHours(data.availableCapacity),
      negative: data.availableCapacity < 0,
    },
    {
      label: "Availability",
      value: formatPercentage(data.availabilityPercentage),
      negative: data.availabilityPercentage < 0,
    },
  ];

  return (
    <section
      aria-label="Filtered availability summary"
      className="grid overflow-hidden rounded-xl border border-slate-200 bg-white sm:grid-cols-2 xl:grid-cols-5"
    >
      {items.map((item, index) => (
        <div
          key={item.label}
          className={`px-5 py-4 ${
            index > 0
              ? "border-t border-slate-200 sm:border-t-0 sm:border-l"
              : ""
          }`}
        >
          <p className="text-xs font-medium text-slate-500">{item.label}</p>

          <p
            className={`mt-1 text-lg font-semibold ${
              item.negative ? "text-red-700" : "text-slate-900"
            }`}
          >
            {item.value}
          </p>

          {item.detail !== undefined && (
            <p className="mt-0.5 text-xs text-slate-400">{item.detail}</p>
          )}
        </div>
      ))}
    </section>
  );
}
