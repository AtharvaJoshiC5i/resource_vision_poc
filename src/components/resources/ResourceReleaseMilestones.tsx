import type { ResourceReleaseEvent } from "../../services/resourceReleaseService";

import { formatHours, formatMonth } from "../../utils/formatters";

function getReleaseTypeLabel(type: ResourceReleaseEvent["type"]): string {
  return type === "FULL_RELEASE" ? "Fully available" : "Gaining capacity";
}

interface ResourceReleaseMilestonesProps {
  events: ResourceReleaseEvent[];
  focusMonth: string;
  emptyMessage?: string;
}

export function ResourceReleaseMilestones({
  events,
  focusMonth,
  emptyMessage,
}: ResourceReleaseMilestonesProps) {
  if (events.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-slate-200 bg-slate-50/50 px-3 py-4 text-xs text-slate-500">
        {emptyMessage ??
          `No further capacity increases after ${formatMonth(focusMonth)} in the planning horizon.`}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white">
      {events.map((event) => (
        <li
          key={`${event.monthKey}-${event.type}`}
          className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-900">
              {formatMonth(event.monthKey)}
            </p>

            <p className="mt-0.5 text-[11px] text-slate-500">
              {getReleaseTypeLabel(event.type)}
              {event.type === "FULL_RELEASE"
                ? " · no remaining project allocations"
                : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:justify-end">
            <span className="font-semibold tabular-nums text-blue-700">
              +{formatHours(event.releasedHours)}
            </span>

            {event.allocationReductionHours > 0 && (
              <span className="tabular-nums text-slate-500">
                Allocations −{formatHours(event.allocationReductionHours)}
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
