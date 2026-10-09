import type {
  AvailabilityTransition,
} from "../../types/domain";

import {
  formatHours,
  formatMonth,
} from "../../utils/formatters";

import {
  Card,
} from "../ui/Card";

interface ResourceUpcomingAvailabilityProps {
  transitions:
    AvailabilityTransition[];
}

export function ResourceUpcomingAvailability({
  transitions,
}: ResourceUpcomingAvailabilityProps) {
  const meaningful =
    transitions.filter(
      (transition) =>
        transition.additionalAvailableHours >
        0,
    );

  if (meaningful.length === 0) {
    return null;
  }

  return (
    <Card>
      <h2 className="text-sm font-semibold text-slate-900">
        Upcoming Availability
      </h2>

      <div className="mt-4 divide-y divide-slate-100">
        {meaningful.map(
          (transition) => (
            <div
              key={`${transition.fromMonthKey}-${transition.toMonthKey}`}
              className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
            >
              <div>
                <p className="text-xs font-semibold text-slate-800">
                  {formatMonth(
                    transition.toMonthKey,
                  )}
                </p>

                <p className="mt-1 text-[11px] text-slate-500">
                  {transition.transitionTypes.includes(
                    "BECAME_FULLY_AVAILABLE",
                  )
                    ? "Becomes fully available"
                    : "Additional capacity becomes available"}
                </p>
              </div>

              <p className="text-sm font-semibold tabular-nums text-slate-900">
                +
                {formatHours(
                  transition.additionalAvailableHours,
                )}
              </p>
            </div>
          ),
        )}
      </div>
    </Card>
  );
}