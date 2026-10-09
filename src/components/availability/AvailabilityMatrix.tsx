import { ChevronDown, ChevronRight } from "lucide-react";

import type {
  AvailabilityCellSelection,
  AvailabilityMatrixMetric,
  AvailabilityMatrixRow,
  MatrixMetric,
} from "../../types/availabilityExplorer";

import { DIMENSION_LABELS } from "../../services/availabilityExplorerService";

import { POC_CURRENT_MONTH } from "../../constants/poc";
import { getCurrentMonthKey } from "../../services/monthService";

import {
  formatHours,
  formatMonth,
  formatMonthShort,
  formatPercentage,
} from "../../utils/formatters";

import { Card } from "../ui/Card";

interface AvailabilityMatrixProps {
  rows: AvailabilityMatrixRow[];
  months: string[];
  metric: MatrixMetric;
  expandedRowIds: Set<string>;

  onToggleRow: (rowId: string) => void;

  onSelectCell: (selection: AvailabilityCellSelection) => void;
}

function formatCellValue(
  metric: AvailabilityMatrixMetric,
  mode: MatrixMetric,
): string {
  switch (mode) {
    case "availabilityPercentage":
      return formatPercentage(metric.availabilityPercentage);

    case "availableCapacity":
      return formatHours(metric.availableCapacity);

    case "utilizedCapacity":
      return formatHours(metric.utilizedCapacity);
  }
}

function isOverAllocated(metric: AvailabilityMatrixMetric): boolean {
  return metric.availableCapacity < 0;
}

export function AvailabilityMatrix({
  rows,
  months,
  metric,
  expandedRowIds,
  onToggleRow,
  onSelectCell,
}: AvailabilityMatrixProps) {
  const singleMonth = months.length === 1;
  const currentMonth = getCurrentMonthKey();

  return (
    <Card padding={false}>
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Availability Matrix
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Expand resource dimensions to explore available capacity.
            </p>
          </div>

          {!singleMonth && (
            <div className="mt-2 flex items-center gap-4 text-xs text-slate-500 sm:mt-0">
              <span>Jan–Aug · Actual · Famstack</span>

              <span className="hidden h-4 border-l border-slate-300 sm:block" />

              <span>Sep–Dec · Planned · Project Track</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-h-[640px] overflow-auto">
        <table className="min-w-max border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-20">
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-30 min-w-72 border-b border-r border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Resource Dimension
              </th>

              {months.map((monthKey) => {
                const planned = monthKey >= POC_CURRENT_MONTH;
                const current = monthKey === currentMonth;

                return (
                  <th
                    key={monthKey}
                    scope="col"
                    className={`min-w-28 border-b px-3 py-3 text-right text-xs font-semibold ${
                      current
                        ? "border-l-2 border-l-blue-300 border-blue-200 bg-blue-100 text-blue-800"
                        : "border-slate-200 bg-slate-50 text-slate-500"
                    }`}
                  >
                    <span className="block text-slate-700">
                      {singleMonth
                        ? formatMonth(monthKey)
                        : formatMonthShort(monthKey)}
                    </span>

                    <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wide text-slate-400">
                      {planned ? "Planned" : "Actual"}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const expanded = expandedRowIds.has(row.id);

              return (
                <tr key={row.id} className="group">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 border-b border-r border-slate-100 bg-white px-3 py-2.5 text-left group-hover:bg-slate-50"
                  >
                    <div
                      className={`flex items-center ${
                        row.depth === 0
                          ? ""
                          : row.depth === 1
                            ? "pl-5"
                            : row.depth === 2
                              ? "pl-10"
                              : row.depth === 3
                                ? "pl-14"
                                : row.depth === 4
                                  ? "pl-18"
                                  : "pl-22"
                      }`}
                    >
                      {row.expandable ? (
                        <button
                          type="button"
                          onClick={() => onToggleRow(row.id)}
                          aria-label={`${
                            expanded ? "Collapse" : "Expand"
                          } ${row.label}`}
                          aria-expanded={expanded}
                          className="mr-1.5 flex size-7 shrink-0 items-center justify-center rounded-md text-slate-500 outline-none hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-600"
                        >
                          {expanded ? (
                            <ChevronDown
                              className="size-4"
                              aria-hidden="true"
                            />
                          ) : (
                            <ChevronRight
                              className="size-4"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      ) : (
                        <span className="mr-1.5 block size-7" />
                      )}

                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">
                          {row.label}
                        </p>

                        <p className="mt-0.5 text-[11px] font-normal text-slate-400">
                          {DIMENSION_LABELS[row.dimension]}
                          {" · "}
                          {row.resourceCount}{" "}
                          {row.resourceCount === 1 ? "resource" : "resources"}
                        </p>
                      </div>
                    </div>
                  </th>

                  {months.map((monthKey) => {
                    const cell = row.monthlyMetrics[monthKey];
                    const current = monthKey === currentMonth;

                    return (
                      <td
                        key={monthKey}
                        className={`border-b border-slate-100 p-1.5 text-right group-hover:bg-slate-50 ${
                          current
                            ? "border-l-2 border-l-blue-300 bg-blue-50/70 group-hover:bg-blue-50/70"
                            : ""
                        }`}
                      >
                        {cell === undefined ? (
                          <span
                            className="inline-flex min-h-9 min-w-20 items-center justify-end px-2 text-slate-300"
                            aria-label="Not applicable"
                          >
                            —
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              onSelectCell({
                                row,
                                monthKey,
                              })
                            }
                            className={`min-h-9 min-w-20 rounded-lg px-2 py-1.5 text-right text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 ${
                              isOverAllocated(cell)
                                ? "bg-red-50 text-red-700 hover:bg-red-100"
                                : "text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                            }`}
                            aria-label={`${row.label}, ${formatMonth(
                              monthKey,
                            )}: ${formatCellValue(cell, metric)}${
                              isOverAllocated(cell) ? ", over allocated" : ""
                            }`}
                          >
                            {formatCellValue(cell, metric)}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
