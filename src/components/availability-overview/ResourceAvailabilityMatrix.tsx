import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import type {
  ResourceAvailabilityMatrixRow,
  ResourceMatrixSort,
  ResourceMatrixSortField,
} from "../../types/resourceAvailabilityMatrix";

import { getCurrentMonthKey } from "../../services/monthService";

import { formatMonthShort } from "../../utils/formatters";

import { ResourceAvailabilityRow } from "./ResourceAvailabilityRow";

import { Card } from "../ui/Card";

interface ResourceAvailabilityMatrixProps {
  rows: ResourceAvailabilityMatrixRow[];

  monthKeys: string[];

  sort: ResourceMatrixSort;

  onSort: (field: ResourceMatrixSortField) => void;
}

function getMonthYear(monthKey: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);

  if (match === null) {
    return "";
  }

  return match[1];
}

interface SortHeaderProps {
  label: string;

  field: ResourceMatrixSortField;

  sort: ResourceMatrixSort;

  onSort: (field: ResourceMatrixSortField) => void;

  align?: "left" | "center";
}

function SortHeader({
  label,
  field,
  sort,
  onSort,
  align = "left",
}: SortHeaderProps) {
  const active = sort.field === field;

  const Icon = !active
    ? ArrowUpDown
    : sort.direction === "asc"
      ? ArrowUp
      : ArrowDown;

  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={`inline-flex items-center gap-1 rounded text-[10px] font-semibold uppercase tracking-[0.06em] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 ${
        active ? "text-slate-700" : "text-slate-500 hover:text-slate-800"
      } ${align === "center" ? "justify-center" : ""}`}
    >
      {label}

      <Icon className="size-3" aria-hidden="true" />
    </button>
  );
}

export function ResourceAvailabilityMatrix({
  rows,
  monthKeys,
  sort,
  onSort,
}: ResourceAvailabilityMatrixProps) {
  const currentMonth = getCurrentMonthKey();

  return (
    <Card padding={false}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-[230px]" />

            <col className="w-[255px]" />

            <col className="w-[120px]" />

            {monthKeys.map((monthKey) => (
              <col key={monthKey} className="w-[112px]" />
            ))}
          </colgroup>

          <thead>
            <tr className="bg-slate-50/90">
              {/* Resource */}

              <th
                scope="col"
                className="sticky left-0 z-30 w-[230px] border-b border-r border-slate-200 bg-slate-50 px-4 py-3.5 text-left"
              >
                <SortHeader
                  label="Resource"
                  field="employeeName"
                  sort={sort}
                  onSort={onSort}
                />
              </th>

              {/* Projects */}

              <th
                scope="col"
                className="w-[255px] border-b border-slate-200 px-4 py-3.5 text-left"
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                  Projects
                </span>
              </th>

              {/* Allocated Until */}

              <th
                scope="col"
                className="w-30 border-b border-r border-slate-200 px-4 py-3.5 text-left"
              >
                <SortHeader
                  label="Until"
                  field="allocatedUntil"
                  sort={sort}
                  onSort={onSort}
                />
              </th>

              {/* Months */}

              {monthKeys.map((monthKey) => (
                <th
                  key={monthKey}
                  scope="col"
                  className={`w-28 border-b px-2 py-2.5 text-center ${
                    monthKey === currentMonth
                      ? "border-blue-200 bg-blue-100"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-[11px] font-semibold uppercase leading-none tracking-wide text-slate-700">
                      {formatMonthShort(monthKey)}
                    </span>

                    <span className="mt-1.5 text-[9px] font-medium leading-none text-slate-400">
                      {getMonthYear(monthKey)}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="bg-white">
            {rows.map((row) => (
              <ResourceAvailabilityRow
                key={row.employeeId}
                row={row}
                monthKeys={monthKeys}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 bg-slate-50/40 px-4 py-3">
        <LegendItem
          className="border-emerald-200 bg-emerald-50"
          label="Available"
        />

        <LegendItem
          className="border-amber-200 bg-amber-50"
          label="Partially Available"
        />

        <LegendItem
          className="border-slate-200 bg-slate-50"
          label="Fully Allocated"
        />

        <LegendItem
          className="border-red-200 bg-red-50"
          label="Over-Allocated"
        />

        <span className="ml-auto text-[10px] text-slate-400">
          Hours shown are available capacity
        </span>
      </div>
    </Card>
  );
}

function LegendItem({
  className,
  label,
}: {
  className: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`size-2.5 rounded border ${className}`}
        aria-hidden="true"
      />

      <span className="text-[10px] font-medium text-slate-500">{label}</span>
    </div>
  );
}
