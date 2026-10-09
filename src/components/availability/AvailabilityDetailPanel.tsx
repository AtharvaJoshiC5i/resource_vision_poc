import { useEffect } from "react";

import { ArrowUpRight, X } from "lucide-react";

import { Link } from "react-router-dom";

import type { AvailabilityDetailData } from "../../types/availabilityExplorer";

import { DIMENSION_LABELS } from "../../services/availabilityExplorerService";

import {
  formatHours,
  formatLongMonth,
  formatPercentage,
} from "../../utils/formatters";

import { Badge } from "../ui/Badge";

interface AvailabilityDetailPanelProps {
  detail: AvailabilityDetailData | null;
  onClose: () => void;
}

export function AvailabilityDetailPanel({
  detail,
  onClose,
}: AvailabilityDetailPanelProps) {
  useEffect(() => {
    if (detail === null) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [detail, onClose]);

  if (detail === null) {
    return null;
  }

  const employeeLevel = detail.dimension === "employee";

  const overAllocated = detail.metrics.availableCapacity < 0;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close availability detail"
        className="absolute inset-0 bg-slate-950/30"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="availability-detail-title"
        className="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {DIMENSION_LABELS[detail.dimension]}
            </p>

            <h2
              id="availability-detail-title"
              className="mt-1 truncate text-lg font-semibold text-slate-900"
            >
              {detail.title}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {formatLongMonth(detail.monthKey)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close detail panel"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-500 outline-none hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <Badge variant={detail.source === "FAMSTACK" ? "neutral" : "blue"}>
            {detail.source === "FAMSTACK"
              ? "Actual · Famstack"
              : "Planned · Project Track"}
          </Badge>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <Metric
              label="Availability"
              value={formatPercentage(detail.metrics.availabilityPercentage)}
              negative={overAllocated}
            />

            <Metric
              label="Resources"
              value={detail.metrics.resourceCount.toLocaleString("en-US")}
            />

            <Metric
              label="Total Capacity"
              value={formatHours(detail.metrics.totalCapacity)}
            />

            <Metric
              label="Utilized Capacity"
              value={formatHours(detail.metrics.utilizedCapacity)}
            />

            <Metric
              label="Available Capacity"
              value={formatHours(detail.metrics.availableCapacity)}
              negative={overAllocated}
            />
          </div>

          {overAllocated && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm font-medium text-red-800">Over allocated</p>

              <p className="mt-1 text-xs leading-5 text-red-700">
                Utilized capacity exceeds total capacity for this selection and
                month.
              </p>
            </div>
          )}

          {employeeLevel ? (
            <EmployeeDetail detail={detail} />
          ) : (
            <ResourceBreakdown detail={detail} />
          )}

          {!employeeLevel && detail.unassignedDemand.length > 0 && (
            <section className="mt-6 border-t border-slate-200 pt-5">
              <h3 className="text-sm font-semibold text-slate-900">
                Unassigned Demand
              </h3>

              <p className="mt-1 text-xs text-slate-500">
                Separate from available resource capacity
              </p>

              <div className="mt-3 flex items-baseline justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-xs text-slate-500">Demand</span>

                <span className="text-sm font-semibold text-slate-900">
                  {formatHours(detail.unassignedDemandHours)}
                  {" · "}
                  {detail.unassignedDemand.length}{" "}
                  {detail.unassignedDemand.length === 1
                    ? "requirement"
                    : "requirements"}
                </span>
              </div>

              <div className="mt-3 divide-y divide-slate-100">
                {detail.unassignedDemand.map((demand, index) => (
                  <div
                    key={`${demand.project_id}-${index}`}
                    className="py-3 first:pt-0"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {demand.project_name}
                        </p>

                        <p className="mt-0.5 text-xs text-slate-500">
                          {demand.proposal_number || demand.project_id}
                        </p>
                      </div>

                      <p className="shrink-0 text-sm font-medium text-slate-800">
                        {formatHours(demand.effort_hours)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}

interface MetricProps {
  label: string;
  value: string;
  negative?: boolean;
}

function Metric({ label, value, negative = false }: MetricProps) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="text-xs text-slate-500">{label}</p>

      <p
        className={`mt-1 text-base font-semibold ${
          negative ? "text-red-700" : "text-slate-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function ResourceBreakdown({ detail }: { detail: AvailabilityDetailData }) {
  return (
    <section className="mt-6 border-t border-slate-200 pt-5">
      <h3 className="text-sm font-semibold text-slate-900">Resources</h3>

      <p className="mt-1 text-xs text-slate-500">
        Highest available capacity first
      </p>

      <div className="mt-3 divide-y divide-slate-100">
        {detail.resources.map((resource) => (
          <Link
            key={resource.employee_id}
            to={`/resources/${encodeURIComponent(resource.employee_id)}`}
            className="group flex items-start justify-between gap-4 py-3 outline-none first:pt-0 hover:text-blue-700 focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <div>
              <div className="flex items-center gap-1">
                <p className="text-sm font-medium text-slate-900 group-hover:text-blue-700">
                  {resource.employee_name}
                </p>

                <ArrowUpRight
                  className="size-3.5 text-slate-400 group-hover:text-blue-600"
                  aria-hidden="true"
                />
              </div>

              <p className="mt-0.5 text-xs text-slate-500">
                {resource.grade}
                {" · "}
                {resource.location}
              </p>
            </div>

            <div className="shrink-0 text-right">
              <p
                className={`text-sm font-medium ${
                  resource.available_capacity < 0
                    ? "text-red-700"
                    : "text-slate-800"
                }`}
              >
                {formatPercentage(resource.availability_percentage)}
              </p>

              <p className="mt-0.5 text-xs text-slate-500">
                {formatHours(resource.available_capacity)} available
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function EmployeeDetail({ detail }: { detail: AvailabilityDetailData }) {
  const employee = detail.resources[0];

  if (employee === undefined) {
    return null;
  }

  return (
    <section className="mt-6 border-t border-slate-200 pt-5">
      <h3 className="text-sm font-semibold text-slate-900">Employee</h3>

      <div className="mt-3 rounded-xl border border-slate-200 p-4">
        <p className="font-medium text-slate-900">{employee.employee_name}</p>

        <p className="mt-1 text-xs text-slate-500">
          {employee.grade}
          {" · "}
          {employee.location}
          {" · "}
          {employee.primary_capability}
        </p>

        <Link
          to={`/resources/${encodeURIComponent(employee.employee_id)}`}
          className="mt-4 inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white outline-none hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          View Resource
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
