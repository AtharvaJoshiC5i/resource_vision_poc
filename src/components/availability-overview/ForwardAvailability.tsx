import type { MonthlyAvailabilitySummary } from "../../types/domain";

import { getCurrentMonthKey } from "../../services/monthService";

interface ForwardAvailabilityProps {
  summaries: readonly MonthlyAvailabilitySummary[];

  selectedMonth: string;

  onSelectMonth: (monthKey: string) => void;
}

interface MetricRow {
  label: string;

  getValue: (summary: MonthlyAvailabilitySummary) => string | number;

  emphasize?: boolean;

  description?: string;

}

function formatHours(value: number): string {
  return `${Math.round(value).toLocaleString()}h`;
}

function formatCount(value: number): string {
  return Math.round(value).toLocaleString();
}

function formatMonth(monthKey: string): {
  month: string;
  year: string;
} {
  const parts = monthKey.split("-");

  if (parts.length !== 2) {
    return {
      month: monthKey,
      year: "",
    };
  }

  const year = parts[0];
  const monthNumber = Number(parts[1]);

  if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    return {
      month: monthKey,
      year,
    };
  }

  const month = new Date(Date.UTC(2026, monthNumber - 1, 1)).toLocaleString(
    "en-US",
    {
      month: "short",
      timeZone: "UTC",
    },
  );

  return {
    month,
    year,
  };
}

function getResourcesWithCapacity(summary: MonthlyAvailabilitySummary): number {
  return summary.resourcesWithCapacity;
}

function getAvailableHours(summary: MonthlyAvailabilitySummary): number {
  return summary.totalAvailableHours;
}

function getTotalCapacity(summary: MonthlyAvailabilitySummary): number {
  return summary.totalCapacityHours;
}

function getFullyAllocated(summary: MonthlyAvailabilitySummary): number {
  return summary.fullyAllocatedResources;
}

function getOverAllocated(summary: MonthlyAvailabilitySummary): number {
  return summary.overAllocatedResources;
}

function MetricValue({
  value,
  emphasize = false,
}: {
  value: string | number;

  emphasize?: boolean;
}) {
  return (
    <span
      className={
        emphasize
          ? "text-[15px] font-semibold tracking-[-0.01em] text-slate-950"
          : "text-sm font-medium text-slate-800"
      }
    >
      {value}
    </span>
  );
}

function MetricLabel({
  label,
  description,
}: {
  label: string;

  description?: string;
}) {
  return (
    <div className="min-w-[132px] pr-2 md:min-w-[170px] md:pr-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </div>

      {description && (
        <div className="mt-1 text-xs leading-4 text-slate-400">
          {description}
        </div>
      )}
    </div>
  );
}

export function ForwardAvailability({
  summaries,
  selectedMonth,
  onSelectMonth,
}: ForwardAvailabilityProps) {
  if (summaries.length === 0) {
    return null;
  }

  const currentMonth = getCurrentMonthKey();

  const metricRows: MetricRow[] = [
    {
      label: "Resources with Capacity",

      description: "Employees with positive available hours",

      getValue: getResourcesWithCapacity,
    },

    {
      label: "Available Hours",

      description: "Usable positive capacity",

      getValue: (summary) => formatHours(getAvailableHours(summary)),

      emphasize: true,
    },

    {
      label: "Total Capacity",

      description: "Monthly workforce capacity",

      getValue: (summary) => formatHours(getTotalCapacity(summary)),
    },

    {
      label: "Fully Allocated",

      description: "Employees with zero available hours",

      getValue: (summary) => formatCount(getFullyAllocated(summary)),
    },

    {
      label: "Over-Allocated",

      description: "Employees below zero available hours",

      getValue: (summary) => formatCount(getOverAllocated(summary)),
    },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {/* Section header */}
      <div className="border-b border-slate-200 px-6 py-5">
        <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-slate-950">
          Forward Availability
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Month-by-month workforce capacity across the planning horizon.
        </p>
      </div>

      {/* Horizontally scrollable table */}
      <div
        role="region"
        aria-label="Monthly availability metrics. Scroll horizontally to view all months."
        tabIndex={0}
        className="overflow-x-auto overscroll-x-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600"
      >
        <table className="w-full min-w-[760px] border-collapse md:min-w-[860px]">
          <thead>
            <tr>
              {/* Corner / row-label cell */}
              <th
                scope="col"
                className="sticky left-0 z-20 w-[168px] min-w-[168px] border-r border-slate-200 bg-white px-3 py-4 text-left md:w-[220px] md:min-w-[220px] md:px-6"
              >
                <span className="sr-only">Availability metric</span>
              </th>

              {summaries.map((summary) => {
                const { month, year } = formatMonth(summary.monthKey);

                const selected = summary.monthKey === selectedMonth;
                const current = summary.monthKey === currentMonth;

                return (
                  <th
                    key={summary.monthKey}
                    scope="col"
                    className={`min-w-[84px] border-b p-0 text-center md:min-w-[130px] ${
                      current
                        ? "border-blue-300 bg-blue-100"
                        : "border-slate-200 bg-slate-50/60"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectMonth(summary.monthKey)}
                      aria-pressed={selected}
                      className={`group flex min-h-[68px] w-full flex-col items-center justify-center px-1.5 py-3 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 md:min-h-[76px] md:px-4 ${
                        current
                          ? "bg-blue-100"
                          : selected
                            ? "bg-blue-50"
                            : "hover:bg-slate-100/80"
                      }`}
                    >
                      <span
                        className={`text-xs font-semibold md:text-sm ${
                          current || selected
                            ? "text-blue-800"
                            : "text-slate-800"
                        }`}
                      >
                        <span className="block">{month}</span>
                        <span className="block text-[10px] font-medium md:text-xs">
                          {year}
                        </span>
                      </span>

                      {selected && (
                        <span className="mt-1 h-1 w-1 rounded-full bg-blue-600" />
                      )}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {metricRows.map((row, rowIndex) => (
              <tr
                key={row.label}
                className={rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50/35"}
              >
                {/* Metric label */}
                <th
                  scope="row"
                  className="sticky left-0 z-10 border-r border-slate-200 bg-inherit px-3 py-4 text-left align-middle md:px-6"
                >
                  <MetricLabel
                    label={row.label}
                    description={row.description}
                  />
                </th>

                {/* Monthly values */}
                {summaries.map((summary) => {
                  const selected = summary.monthKey === selectedMonth;
                  const current = summary.monthKey === currentMonth;

                  const value = row.getValue(summary);

                  return (
                    <td
                      key={`${row.label}-${summary.monthKey}`}
                      className={`min-w-[84px] border-l px-2 py-4 text-center align-middle transition-colors md:min-w-[130px] md:px-4 ${
                        current
                          ? "border-blue-200 bg-blue-50"
                          : selected
                            ? "border-slate-100 bg-blue-50/45"
                            : "border-slate-100"
                      }`}
                    >
                      <MetricValue
                        value={value}
                        emphasize={row.emphasize}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bottom context strip */}
      <div className="border-t border-slate-200 bg-slate-50/60 px-4 py-3 md:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <p className="text-xs text-slate-500">
            <span className="md:hidden">Swipe to view all months. </span>
            Select a month to change the focus month for the availability view.
          </p>

          <p className="text-xs font-medium text-slate-600 sm:shrink-0">
            {summaries.length} {summaries.length === 1 ? "month" : "months"} in
            horizon
          </p>
        </div>
      </div>
    </section>
  );
}
