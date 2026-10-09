import type { EmployeeMonthAvailability } from "../../types/domain";

import { formatHours, formatLongMonth } from "../../utils/formatters";

interface AvailabilityMonthCellProps {
  availability: EmployeeMonthAvailability | null;

  monthKey: string;

  metric?: "availableHours" | "availableToPromiseHours";
}

function getStatusLabel(availability: EmployeeMonthAvailability): string {
  switch (availability.status) {
    case "AVAILABLE":
      return "Available";

    case "PARTIALLY_AVAILABLE":
      return "Partial";

    case "FULLY_ALLOCATED":
      return "Allocated";

    case "OVER_ALLOCATED":
      return "Over";
  }
}

function getCellClasses(availability: EmployeeMonthAvailability): string {
  switch (availability.status) {
    case "AVAILABLE":
      return "border-emerald-200 bg-emerald-50/70";

    case "PARTIALLY_AVAILABLE":
      return "border-amber-200 bg-amber-50/60";

    case "FULLY_ALLOCATED":
      return "border-slate-200 bg-slate-50";

    case "OVER_ALLOCATED":
      return "border-red-200 bg-red-50/70";
  }
}

function getHoursClasses(availability: EmployeeMonthAvailability): string {
  switch (availability.status) {
    case "AVAILABLE":
      return "text-slate-900";

    case "PARTIALLY_AVAILABLE":
      return "text-slate-900";

    case "FULLY_ALLOCATED":
      return "text-slate-700";

    case "OVER_ALLOCATED":
      return "text-red-700";
  }
}

function getStatusClasses(availability: EmployeeMonthAvailability): string {
  switch (availability.status) {
    case "AVAILABLE":
      return "text-emerald-700";

    case "PARTIALLY_AVAILABLE":
      return "text-amber-700";

    case "FULLY_ALLOCATED":
      return "text-slate-500";

    case "OVER_ALLOCATED":
      return "text-red-700";
  }
}

function buildExplanation(
  availability: EmployeeMonthAvailability,
  monthKey: string,
): string {
  const projectText =
    availability.projectAllocations.length === 0
      ? "No project allocations."
      : availability.projectAllocations
          .map(
            (project) =>
              `${project.projectName}: ${formatHours(project.allocatedHours)}`,
          )
          .join(". ");

  return [
    `${formatLongMonth(monthKey)}.`,
    `Capacity ${formatHours(availability.totalCapacityHours)}.`,
    `Allocated ${formatHours(availability.allocatedHours)}.`,
    projectText,
    `Available ${formatHours(availability.availableHours)}.`,
  ].join(" ");
}

export function AvailabilityMonthCell({
  availability,
  monthKey,
  metric = "availableHours",
}: AvailabilityMonthCellProps) {
  if (availability === null) {
    return (
      <div
        title={`${formatLongMonth(monthKey)}: Not in workforce`}
        className="flex h-[54px] w-full flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50/60"
      >
        <span className="text-sm font-semibold text-slate-300">—</span>

        <span className="mt-0.5 text-[10px] font-medium leading-none text-slate-400">
          Not active
        </span>
      </div>
    );
  }

  const hours =
    metric === "availableToPromiseHours"
      ? availability.availableToPromiseHours
      : availability.availableHours;

  return (
    <div
      title={buildExplanation(availability, monthKey)}
      className={`flex h-[54px] w-full flex-col items-center justify-center rounded-lg border ${getCellClasses(
        availability,
      )}`}
    >
      <span
        className={`whitespace-nowrap text-[13px] font-semibold leading-none tabular-nums ${getHoursClasses(
          availability,
        )}`}
      >
        {formatHours(hours)}
      </span>

      <span
        className={`mt-1.5 whitespace-nowrap text-[10px] font-medium leading-none ${getStatusClasses(
          availability,
        )}`}
      >
        {getStatusLabel(availability)}
      </span>
    </div>
  );
}
