import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import type {
  ResourceAvailabilityMatrixRow,
  ResourceMatrixSort,
  ResourceMatrixSortField,
} from "../../types/resourceAvailabilityMatrix";

import { formatMonthShort } from "../../utils/formatters";

import { ResourceAvailabilityRow } from "./ResourceAvailabilityRow";

import { Card } from "../ui/Card";
import type { TablePaginationProps } from "../ui/TablePagination";
import { TablePagination } from "../ui/TablePagination";

interface ResourceAvailabilityMatrixProps {
  rows: ResourceAvailabilityMatrixRow[];

  monthKeys: string[];

  /** Highlights the focus month column (defaults to first visible month). */
  highlightMonthKey?: string;

  sort: ResourceMatrixSort;

  onSort: (field: ResourceMatrixSortField) => void;

  pagination?: Omit<TablePaginationProps, "itemLabel">;

  selectedEmployeeId?: string | null;

  onSelectEmployee?: (employeeId: string) => void;
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
      className={`inline-flex items-center gap-1.5 rounded text-xs font-semibold uppercase tracking-wide outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 ${
        active ? "text-slate-800" : "text-slate-600 hover:text-slate-900"
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
  highlightMonthKey,
  sort,
  onSort,
  pagination,
  selectedEmployeeId = null,
  onSelectEmployee,
}: ResourceAvailabilityMatrixProps) {
  const focusMonthKey = highlightMonthKey ?? monthKeys[0];

  const minTableWidth =
    520 + Math.max(monthKeys.length, 1) * 140;

  return (
    <Card padding={false}>
      <div className="overflow-x-auto">
        <table
          className="w-full table-fixed border-collapse text-sm leading-normal"
          style={{ minWidth: `${minTableWidth}px` }}
        >
          <colgroup>
            <col className="w-[min(220px,22%)]" />

            <col className="w-[min(240px,24%)]" />

            <col className="w-[min(100px,10%)]" />

            {monthKeys.map((monthKey) => (
              <col key={monthKey} />
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
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
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
                  className={`border-b px-2 py-2.5 text-center ${
                    monthKey === focusMonthKey
                      ? "border-blue-200/80 bg-blue-50/90"
                      : "border-slate-200 bg-slate-50/90"
                  }`}
                >
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-[11px] font-semibold uppercase leading-tight tracking-wide text-slate-800">
                      {formatMonthShort(monthKey)}
                    </span>

                    <span className="mt-0.5 text-[10px] font-medium leading-tight text-slate-500">
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
                highlightMonthKey={focusMonthKey}
                isSelected={selectedEmployeeId === row.employeeId}
                onSelect={
                  onSelectEmployee === undefined
                    ? undefined
                    : () => onSelectEmployee(row.employeeId)
                }
              />
            ))}
          </tbody>
        </table>
      </div>

      {pagination !== undefined && (
        <TablePagination {...pagination} itemLabel="resources" />
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 border-t border-slate-100 bg-slate-50/40 px-5 py-3.5">
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

        <span className="ml-auto text-xs leading-5 text-slate-600">
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

      <span className="text-xs font-medium text-slate-600">{label}</span>
    </div>
  );
}
