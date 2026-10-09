import { ArrowDown, ArrowUp, ArrowUpDown, ArrowUpRight } from "lucide-react";

import { Link } from "react-router-dom";

import type { AvailabilityStatus } from "../../types/resourceMonthly";

import type {
  ResourceSort,
  ResourceSortField,
  ResourceTableRow,
} from "../../types/resources";

import { RESOURCE_OUTLOOK_MONTHS } from "../../services/resourcesService";

import {
  formatHours,
  formatMonthShort,
  formatPercentage,
} from "../../utils/formatters";

import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";

interface ResourceTableProps {
  rows: ResourceTableRow[];
  sort: ResourceSort;

  onSort: (field: ResourceSortField) => void;
}

const STATUS_PRESENTATION: Record<
  AvailabilityStatus,
  {
    label: string;
    variant: "neutral" | "blue" | "green" | "amber" | "red";
  }
> = {
  AVAILABLE: {
    label: "Available",
    variant: "green",
  },

  PARTIALLY_AVAILABLE: {
    label: "Partially Available",
    variant: "blue",
  },

  FULLY_ALLOCATED: {
    label: "Fully Allocated",
    variant: "amber",
  },

  OVER_ALLOCATED: {
    label: "Over Allocated",
    variant: "red",
  },
};

interface SortHeaderProps {
  label: string;
  field: ResourceSortField;
  sort: ResourceSort;
  align?: "left" | "right";

  onSort: (field: ResourceSortField) => void;
}

function SortHeader({
  label,
  field,
  sort,
  align = "left",
  onSort,
}: SortHeaderProps) {
  const active = sort.field === field;

  const Icon = !active
    ? ArrowUpDown
    : sort.direction === "asc"
      ? ArrowUp
      : ArrowDown;

  const directionLabel = active
    ? sort.direction === "asc"
      ? "ascending"
      : "descending"
    : "not sorted";

  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      aria-label={`Sort ${label}. Currently ${directionLabel}.`}
      className={`inline-flex items-center gap-1 rounded-md text-xs font-semibold uppercase tracking-wide text-slate-500 outline-none hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-600 ${
        align === "right" ? "justify-end" : ""
      }`}
    >
      {label}

      <Icon className="size-3.5" aria-hidden="true" />
    </button>
  );
}

function OutlookCell({ row }: { row: ResourceTableRow }) {
  return (
    <div className="flex min-w-72 gap-1.5">
      {RESOURCE_OUTLOOK_MONTHS.map((monthKey) => {
        const month = row.outlook[monthKey];

        return (
          <div
            key={monthKey}
            className="min-w-14 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-center"
          >
            <p className="text-[10px] font-semibold uppercase text-slate-400">
              {formatMonthShort(monthKey)}
            </p>

            {month === undefined ? (
              <p
                className="mt-0.5 text-xs font-medium text-slate-300"
                aria-label={`${formatMonthShort(monthKey)}: not applicable`}
              >
                —
              </p>
            ) : (
              <p
                className={`mt-0.5 text-xs font-medium ${
                  month.availableCapacity < 0
                    ? "text-red-700"
                    : "text-slate-700"
                }`}
              >
                {formatPercentage(month.availabilityPercentage)}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ResourceTable({ rows, sort, onSort }: ResourceTableProps) {
  return (
    <Card padding={false}>
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Resource Availability
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {rows.length} {rows.length === 1 ? "resource" : "resources"} in
              the current view
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-max divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-20 min-w-56 border-r border-slate-200 bg-slate-50 px-5 py-3 text-left"
              >
                <SortHeader
                  label="Employee"
                  field="employeeName"
                  sort={sort}
                  onSort={onSort}
                />
              </th>

              <th
                scope="col"
                className="min-w-44 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Primary Capability
              </th>

              <th
                scope="col"
                className="min-w-44 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Secondary Capability
              </th>

              <th
                scope="col"
                className="min-w-20 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Grade
              </th>

              <th
                scope="col"
                className="min-w-40 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Location
              </th>

              <th
                scope="col"
                className="min-w-28 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Capacity
              </th>

              <th scope="col" className="min-w-28 px-4 py-3 text-right">
                <SortHeader
                  label="Utilized"
                  field="utilizedCapacity"
                  sort={sort}
                  align="right"
                  onSort={onSort}
                />
              </th>

              <th scope="col" className="min-w-28 px-4 py-3 text-right">
                <SortHeader
                  label="Available"
                  field="availableCapacity"
                  sort={sort}
                  align="right"
                  onSort={onSort}
                />
              </th>

              <th scope="col" className="min-w-32 px-4 py-3 text-right">
                <SortHeader
                  label="Availability"
                  field="availabilityPercentage"
                  sort={sort}
                  align="right"
                  onSort={onSort}
                />
              </th>

              <th
                scope="col"
                className="min-w-40 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Status
              </th>

              <th
                scope="col"
                className="min-w-72 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Outlook
              </th>

              <th scope="col" className="w-20 px-5 py-3 text-right">
                <span className="sr-only">View resource</span>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((row) => {
              const status = STATUS_PRESENTATION[row.availabilityStatus];

              const negative = row.availableCapacity < 0;

              return (
                <tr key={row.employeeId} className="group hover:bg-slate-50">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 border-r border-slate-100 bg-white px-5 py-3 text-left group-hover:bg-slate-50"
                  >
                    <Link
                      to={`/resources/${encodeURIComponent(row.employeeId)}`}
                      className="block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    >
                      <p className="font-medium text-slate-900 hover:text-blue-700">
                        {row.employeeName}
                      </p>

                      <p className="mt-0.5 text-xs font-normal text-slate-500">
                        {row.employeeId}
                      </p>
                    </Link>
                  </th>

                  <td className="px-4 py-3 text-slate-700">
                    {row.primaryCapability}
                  </td>

                  <td className="px-4 py-3 text-slate-700">
                    {row.secondaryCapability}
                  </td>

                  <td className="px-4 py-3 text-slate-700">{row.grade}</td>

                  <td className="px-4 py-3">
                    <p className="text-slate-700">{row.location}</p>

                    <p className="mt-0.5 text-xs text-slate-400">
                      {row.country}
                    </p>
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                    {formatHours(row.totalCapacity)}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                    {formatHours(row.utilizedCapacity)}
                  </td>

                  <td
                    className={`whitespace-nowrap px-4 py-3 text-right font-medium ${
                      negative ? "text-red-700" : "text-slate-800"
                    }`}
                  >
                    {formatHours(row.availableCapacity)}
                  </td>

                  <td
                    className={`whitespace-nowrap px-4 py-3 text-right font-medium ${
                      negative ? "text-red-700" : "text-slate-800"
                    }`}
                  >
                    {formatPercentage(row.availabilityPercentage)}
                  </td>

                  <td className="px-4 py-3">
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </td>

                  <td className="px-4 py-3">
                    <OutlookCell row={row} />
                  </td>

                  <td className="px-5 py-3 text-right">
                    <Link
                      to={`/resources/${encodeURIComponent(row.employeeId)}`}
                      aria-label={`View ${row.employeeName}`}
                      className="inline-flex size-8 items-center justify-center rounded-lg text-slate-400 outline-none hover:bg-blue-50 hover:text-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600"
                    >
                      <ArrowUpRight className="size-4" aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
