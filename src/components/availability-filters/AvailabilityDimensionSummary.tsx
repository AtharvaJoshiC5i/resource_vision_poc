import { Fragment, useState } from "react";

import { ChevronDown, ChevronRight } from "lucide-react";

import { Link } from "react-router-dom";

import {
  RESOURCE_DIMENSION_LABELS,
  RESOURCE_DIMENSION_ORDER,
} from "../../constants/resourceDimensions";

import { listEmployeesInDimensionGroup } from "../../services/availabilityDimensionService";

import { getOperationalAvailableHours } from "../../services/resourceFilterService";

import type { EmployeeMonthAvailability } from "../../types/domain";

import type {
  AvailabilityDimensionAggregate,
  ResourceDimension,
} from "../../types/resourceFilters";

import type { DimensionDrillCrumb } from "../../utils/dimensionDrill";

import { getNextDrillDimension } from "../../utils/dimensionDrill";

import { formatHours, formatMonth } from "../../utils/formatters";

import { Card } from "../ui/Card";

interface AvailabilityDimensionSummaryProps {
  dimension: ResourceDimension;

  monthKey: string;

  rows: AvailabilityDimensionAggregate[];

  monthRecords: EmployeeMonthAvailability[];

  drillPath: DimensionDrillCrumb[];

  onDimensionChange: (dimension: ResourceDimension) => void;

  onDrillInto: (value: string) => void;

  onDrillBreadcrumb: (breadcrumbIndex: number) => void;
}

function showsEmployeeRoster(dimension: ResourceDimension): boolean {
  return dimension === "country" || dimension === "location";
}

export function AvailabilityDimensionSummary({
  dimension,
  monthKey,
  rows,
  monthRecords,
  drillPath,
  onDimensionChange,
  onDrillInto,
  onDrillBreadcrumb,
}: AvailabilityDimensionSummaryProps) {
  const nextDimension = getNextDrillDimension(dimension);
  const rosterEnabled = showsEmployeeRoster(dimension);

  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());

  function toggleExpanded(rowKey: string) {
    setExpandedKeys((current) => {
      const next = new Set(current);

      if (next.has(rowKey)) {
        next.delete(rowKey);
      } else {
        next.add(rowKey);
      }

      return next;
    });
  }

  return (
    <Card padding={false}>
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">
            Availability by {RESOURCE_DIMENSION_LABELS[dimension]}
          </h2>

          <p className="mt-1 text-xs text-slate-500">{formatMonth(monthKey)}</p>

          {rosterEnabled && (
            <p className="mt-1 text-xs text-slate-500">
              Expand a row to see employees in that{" "}
              {dimension === "country" ? "country" : "location"}.
            </p>
          )}

          {drillPath.length > 0 && (
            <nav
              aria-label="Dimension drill-down path"
              className="mt-3 flex flex-wrap items-center gap-1 text-xs"
            >
              <button
                type="button"
                onClick={() => onDrillBreadcrumb(-1)}
                className="rounded px-1.5 py-0.5 font-medium text-slate-600 outline-none hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                All
              </button>

              {drillPath.map((crumb, index) => (
                <span
                  key={`${crumb.dimension}-${crumb.value}`}
                  className="flex items-center gap-1"
                >
                  <ChevronRight
                    className="size-3 text-slate-300"
                    aria-hidden="true"
                  />

                  <button
                    type="button"
                    onClick={() => onDrillBreadcrumb(index)}
                    className="max-w-[12rem] truncate rounded px-1.5 py-0.5 font-medium text-slate-700 outline-none hover:bg-slate-100 hover:text-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600"
                    title={crumb.value}
                  >
                    {crumb.value}
                  </button>
                </span>
              ))}
            </nav>
          )}
        </div>

        <div className="shrink-0">
          <label
            htmlFor="availability-group-by"
            className="mb-1 block text-[11px] font-medium text-slate-500"
          >
            Group by
          </label>

          <select
            id="availability-group-by"
            value={dimension}
            onChange={(event) => {
              setExpandedKeys(new Set());
              onDimensionChange(event.target.value as ResourceDimension);
            }}
            className="h-9 min-w-[11rem] rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            {RESOURCE_DIMENSION_ORDER.map((item) => (
              <option key={item} value={item}>
                {RESOURCE_DIMENSION_LABELS[item]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-slate-500">
          No dimension data for the current filters.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {rosterEnabled && (
                  <th className="w-10 px-3 py-3" scope="col">
                    <span className="sr-only">Show employees</span>
                  </th>
                )}

                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {RESOURCE_DIMENSION_LABELS[dimension]}
                </th>

                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Resources
                </th>

                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  With Capacity
                </th>

                <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Available Hours
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 bg-white">
              {rows.map((row) => {
                const canDrill = nextDimension !== null;
                const isExpanded = expandedKeys.has(row.key);
                const employees = rosterEnabled
                  ? listEmployeesInDimensionGroup(
                      monthRecords,
                      dimension,
                      monthKey,
                      row.key,
                    )
                  : [];

                return (
                  <Fragment key={row.key}>
                    <tr className="hover:bg-slate-50">
                      {rosterEnabled && (
                        <td className="px-3 py-3 align-top">
                          <button
                            type="button"
                            onClick={() => toggleExpanded(row.key)}
                            aria-expanded={isExpanded}
                            aria-label={`${isExpanded ? "Hide" : "Show"} employees in ${row.key}`}
                            className="inline-flex size-8 items-center justify-center rounded-lg text-slate-500 outline-none hover:bg-slate-100 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-blue-600"
                          >
                            <ChevronDown
                              className={`size-4 transition-transform ${
                                isExpanded ? "rotate-0" : "-rotate-90"
                              }`}
                              aria-hidden="true"
                            />
                          </button>
                        </td>
                      )}

                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => onDrillInto(row.key)}
                          disabled={!canDrill}
                          title={
                            canDrill
                              ? `Drill into ${RESOURCE_DIMENSION_LABELS[nextDimension]}`
                              : "Deepest drill level"
                          }
                          className={`group inline-flex max-w-full items-center gap-1.5 rounded text-left text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                            canDrill
                              ? "text-slate-800 hover:text-blue-700"
                              : "cursor-default text-slate-800"
                          }`}
                        >
                          <span className="truncate">{row.key}</span>

                          {canDrill && (
                            <ChevronRight
                              className="size-4 shrink-0 text-slate-400 group-hover:text-blue-600"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      </td>

                      <td className="px-4 py-3 text-right text-sm tabular-nums text-slate-600">
                        {row.totalResources.toLocaleString("en-US")}
                      </td>

                      <td className="px-4 py-3 text-right text-sm tabular-nums text-slate-600">
                        {row.resourcesWithCapacity.toLocaleString("en-US")}
                      </td>

                      <td className="px-5 py-3 text-right text-sm font-semibold tabular-nums text-slate-900">
                        {formatHours(row.availableHours)}
                      </td>
                    </tr>

                    {rosterEnabled && isExpanded && (
                      <tr className="bg-slate-50/80">
                        <td
                          colSpan={rosterEnabled ? 5 : 4}
                          className="px-5 py-4"
                        >
                          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Employees in {row.key}
                          </p>

                          {employees.length === 0 ? (
                            <p className="text-sm text-slate-500">
                              No employees match this group for the selected
                              month.
                            </p>
                          ) : (
                            <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
                              {employees.map((employee) => {
                                const availableHours = Math.max(
                                  getOperationalAvailableHours(employee),
                                  0,
                                );

                                return (
                                  <li
                                    key={employee.employeeId}
                                    className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                                  >
                                    <div className="min-w-0">
                                      <Link
                                        to={`/resources/${encodeURIComponent(employee.employeeId)}`}
                                        className="text-sm font-medium text-slate-900 hover:text-blue-700"
                                      >
                                        {employee.employeeName}
                                      </Link>

                                      <p className="mt-0.5 text-xs text-slate-500">
                                        {employee.employeeId}
                                        <span className="mx-1.5 text-slate-300">
                                          ·
                                        </span>
                                        {employee.grade}
                                        <span className="mx-1.5 text-slate-300">
                                          ·
                                        </span>
                                        {employee.location},{" "}
                                        {employee.country}
                                      </p>
                                    </div>

                                    <p className="shrink-0 text-sm font-medium tabular-nums text-slate-800">
                                      {formatHours(availableHours)} available
                                    </p>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>

          {nextDimension !== null && (
            <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
              Select a row to drill into{" "}
              <span className="font-medium text-slate-700">
                {RESOURCE_DIMENSION_LABELS[nextDimension]}
              </span>
              .
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
