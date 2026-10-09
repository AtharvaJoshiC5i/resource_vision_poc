import type {
  ProjectMonthlyEffort,
} from "../../types/projectAvailability";

import { getCurrentMonthKey } from "../../services/monthService";

import {
  formatHours,
  formatMonthShort,
} from "../../utils/formatters";

import {
  Card,
} from "../ui/Card";

interface ProjectMonthlyEffortSummaryProps {
  months:
    ProjectMonthlyEffort[];
}

export function ProjectMonthlyEffortSummary({
  months,
}: ProjectMonthlyEffortSummaryProps) {
  const currentMonth = getCurrentMonthKey();

  return (
    <Card>
      <div>
        <h2 className="text-sm font-semibold text-slate-900">
          Monthly Project Effort
        </h2>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          Planned employee effort assigned to this project by month.
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {months.map(
          (month) => (
            <div
              key={
                month.monthKey
              }
              className={`rounded-lg border p-3 ${
                month.monthKey === currentMonth
                  ? "border-blue-200 bg-blue-50"
                  : "border-slate-200 bg-slate-50/50"
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {formatMonthShort(
                  month.monthKey,
                )}
              </p>

              <p className="mt-2 text-lg font-semibold tabular-nums text-slate-900">
                {formatHours(
                  month.totalAllocatedHours,
                )}
              </p>

              <p className="mt-1 text-[10px] text-slate-500">
                Planned project effort
              </p>

              <p className="mt-2 text-[10px] font-medium text-slate-400">
                {month.resourceCount.toLocaleString(
                  "en-US",
                )}{" "}
                {month.resourceCount ===
                1
                  ? "assigned resource"
                  : "assigned resources"}
              </p>
            </div>
          ),
        )}
      </div>
    </Card>
  );
}