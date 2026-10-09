import type { EmployeeMonthAvailability } from "../../types/domain";

import { getExpectedRelease } from "../../services/resourceReleaseService";

import { formatHours, formatMonth } from "../../utils/formatters";

interface ResourceReleaseSummaryProps {
  records: EmployeeMonthAvailability[];
  employeeId: string;
  focusMonth: string;
  compact?: boolean;
}

export function ResourceReleaseSummary({
  records,
  employeeId,
  focusMonth,
  compact = false,
}: ResourceReleaseSummaryProps) {
  const release = getExpectedRelease(records, employeeId, focusMonth);

  if (!release) {
    return null;
  }

  const currentRecord = records.find(
    (record) =>
      record.employeeId === employeeId && record.monthKey === focusMonth,
  );

  const isAvailableNow = currentRecord?.status === "AVAILABLE";

  const nextRelease = release.nextCapacityIncreaseMonth;

  const fullAvailability = release.fullAvailabilityMonth;

  return (
    <section
      aria-label="Resource release timing"
      className={
        compact
          ? "rounded-lg border border-slate-200 bg-white px-4 py-3"
          : "rounded-xl border border-slate-200 bg-white p-5"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Expected Resource Release
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Based on monthly planned allocations
          </p>
        </div>

        <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
          Monthly estimate
        </span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Available in Focus Month
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
            {formatHours(release.currentAvailableHours)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {isAvailableNow ? "Fully available" : "Current monthly capacity"}
          </p>
        </div>

        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Next Capacity Increase
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {nextRelease ? formatMonth(nextRelease) : "Not identified"}
          </p>
          <p className="mt-1 text-xs font-medium tabular-nums text-blue-700">
            {nextRelease
              ? `+${formatHours(release.nextCapacityIncreaseHours)}`
              : "No upcoming increase"}
          </p>
        </div>

        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Full Availability
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {isAvailableNow
              ? "Available now"
              : fullAvailability
                ? formatMonth(fullAvailability)
                : "Not identified"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Within the known planning horizon
          </p>
        </div>
      </div>

      {!compact && (
        <p className="mt-4 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">
          {release.releaseContext} Release timing is month-level; an exact day
          within the month cannot be inferred from monthly allocations.
        </p>
      )}
    </section>
  );
}
