import type { EmployeeMonthAvailability } from "../../types/domain";

import { getExpectedRelease } from "../../services/resourceReleaseService";

import { formatHours, formatMonth } from "../../utils/formatters";

import { ResourceReleaseMilestones } from "../resources/ResourceReleaseMilestones";

interface ResourceReleaseSummaryProps {
  records: EmployeeMonthAvailability[];
  employeeId: string;
  focusMonth: string;
}

export function ResourceReleaseSummary({
  records,
  employeeId,
  focusMonth,
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

  const fullAvailability = release.fullAvailabilityMonth;

  return (
    <section
      aria-label="Resource release timing"
      className="rounded-xl border border-slate-200 bg-white p-5"
    >
      <div>
        <h3 className="text-sm font-semibold text-slate-900">
          Expected resource release
        </h3>

        <p className="mt-1 text-xs text-slate-500">
          Based on monthly planned allocations · focus{" "}
          {formatMonth(focusMonth)}
        </p>
      </div>

      <p className="mt-4 text-xs leading-5 text-slate-700">
        <span className="font-semibold text-slate-900">
          {formatHours(release.currentAvailableHours)}
        </span>{" "}
        available in {formatMonth(focusMonth)}.
        {!isAvailableNow && fullAvailability !== null && (
          <>
            {" "}
            Full availability expected{" "}
            <span className="font-medium text-slate-900">
              {formatMonth(fullAvailability)}
            </span>
            .
          </>
        )}
        {isAvailableNow && " Fully available in the focus month."}
      </p>

      <div className="mt-4">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
          Upcoming capacity increases
        </p>

        <ResourceReleaseMilestones
          events={release.releaseEvents}
          focusMonth={focusMonth}
        />
      </div>

      <p className="mt-4 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">
        {release.releaseContext} Release timing is month-level; an exact day
        within the month cannot be inferred from monthly allocations.
      </p>
    </section>
  );
}
