import { useEffect } from "react";

import { ArrowUpRight, X } from "lucide-react";

import { Link } from "react-router-dom";

import type {
  AvailabilityTransition,
  EmployeeMonthAvailability,
} from "../../types/domain";

import {
  partitionUpcomingAvailabilityTransitions,
} from "../../services/upcomingAvailabilityService";

import {
  formatHours,
  formatLongMonth,
  formatMonthShort,
} from "../../utils/formatters";

interface UpcomingAvailabilityMonthModalProps {
  monthKey: string;
  transitions: AvailabilityTransition[];
  monthRecords: EmployeeMonthAvailability[];
  onClose: () => void;
}

export function UpcomingAvailabilityMonthModal({
  monthKey,
  transitions,
  monthRecords,
  onClose,
}: UpcomingAvailabilityMonthModalProps) {
  const recordsByEmployee = new Map(
    monthRecords
      .filter((record) => record.monthKey === monthKey)
      .map((record) => [record.employeeId, record]),
  );
  const monthTransitions = transitions.filter(
    (transition) =>
      transition.toMonthKey === monthKey &&
      transition.additionalAvailableHours > 0,
  );

  const { fullyAvailable, partiallyAvailable } =
    partitionUpcomingAvailabilityTransitions(monthTransitions);

  const totalGain = monthTransitions.reduce(
    (sum, transition) => sum + transition.additionalAvailableHours,
    0,
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close upcoming availability details"
        className="absolute inset-0 bg-slate-950/40"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upcoming-availability-month-title"
        className="relative flex max-h-[min(85vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Upcoming availability
            </p>

            <h2
              id="upcoming-availability-month-title"
              className="mt-1 text-lg font-semibold text-slate-900"
            >
              {formatLongMonth(monthKey)}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {monthTransitions.length.toLocaleString("en-US")} resources gaining
              capacity · +{formatHours(totalGain)} total
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-500 outline-none hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <EmployeeSection
            title="Becoming fully available"
            description="Resources moving to full availability this month."
            transitions={fullyAvailable}
            recordsByEmployee={recordsByEmployee}
            emptyMessage="No resources become fully available this month."
          />

          <EmployeeSection
            title="Partially available"
            description="Resources gaining hours while still allocated on projects."
            transitions={partiallyAvailable}
            recordsByEmployee={recordsByEmployee}
            emptyMessage="No partial capacity gains this month."
            className="mt-8"
          />
        </div>

        <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3">
          <p className="text-[11px] leading-5 text-slate-500">
            Hours shown are available capacity after planned effort. Capacity
            gain is the change from the prior month.
          </p>
        </div>
      </div>
    </div>
  );
}

function EmployeeSection({
  title,
  description,
  transitions,
  recordsByEmployee,
  emptyMessage,
  className = "",
}: {
  title: string;
  description: string;
  transitions: AvailabilityTransition[];
  recordsByEmployee: Map<string, EmployeeMonthAvailability>;
  emptyMessage: string;
  className?: string;
}) {
  return (
    <section className={className}>
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-900">
          {title}
          <span className="ml-2 text-sm font-medium text-slate-500">
            ({transitions.length.toLocaleString("en-US")})
          </span>
        </h3>

        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      </div>

      {transitions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center text-sm text-slate-500">
          {emptyMessage}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {transitions.map((transition) => (
            <li key={`${transition.employeeId}-${transition.fromMonthKey}`}>
              <EmployeeRow
                transition={transition}
                record={recordsByEmployee.get(transition.employeeId)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EmployeeRow({
  transition,
  record,
}: {
  transition: AvailabilityTransition;
  record?: EmployeeMonthAvailability;
}) {
  return (
    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <Link
          to={`/resources/${encodeURIComponent(transition.employeeId)}`}
          className="group inline-flex max-w-full items-center gap-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <span className="truncate text-sm font-semibold text-slate-900 group-hover:text-blue-700">
            {transition.employeeName}
          </span>

          <ArrowUpRight
            className="size-3.5 shrink-0 text-slate-300 group-hover:text-blue-600"
            aria-hidden="true"
          />
        </Link>

        <p className="mt-0.5 text-xs text-slate-500">
          ID {transition.employeeId}
          {record !== undefined && (
            <>
              {" · "}
              {record.grade}
              {" · "}
              {record.primaryCapability}
              {record.location.length > 0 && (
                <>
                  {" · "}
                  {record.location}
                </>
              )}
            </>
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:justify-end">
        <span className="text-slate-500">
          {formatMonthShort(transition.fromMonthKey)}
          {" → "}
          {formatMonthShort(transition.toMonthKey)}
        </span>

        <span className="tabular-nums text-slate-600">
          {formatHours(transition.previousAvailableHours)}
          {" → "}
          <span className="font-semibold text-slate-900">
            {formatHours(transition.currentAvailableHours)}
          </span>
        </span>

        <span className="font-semibold tabular-nums text-blue-700">
          +{formatHours(transition.additionalAvailableHours)} gain
        </span>
      </div>
    </div>
  );
}
