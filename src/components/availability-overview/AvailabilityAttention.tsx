import {
  AlertTriangle,
  ArrowDownRight,
} from "lucide-react";

import {
  Link,
} from "react-router-dom";

import type {
  AvailabilityAttentionItem,
} from "../../types/availabilityAttention";

import {
  formatHours,
  formatMonth,
} from "../../utils/formatters";

import {
  Card,
} from "../ui/Card";

interface AvailabilityAttentionProps {
  items:
    AvailabilityAttentionItem[];

  maxRows?: number;
}

function getDescription(
  item:
    AvailabilityAttentionItem,
): string {
  switch (item.type) {
    case "OVER_ALLOCATED":
      return `${formatHours(
        item.overAllocatedHours,
      )} over capacity`;

    case "BECOMING_OVER_ALLOCATED":
      return `Becomes over-allocated`;

    case "BECOMING_FULLY_ALLOCATED":
      return "Becomes fully allocated";

    case "CAPACITY_REDUCTION":
      return `${formatHours(
        Math.abs(
          item.changeHours ?? 0,
        ),
      )} less capacity`;
  }
}

export function AvailabilityAttention({
  items,
  maxRows = 6,
}: AvailabilityAttentionProps) {
  const visible =
    items.slice(
      0,
      maxRows,
    );

  return (
    <Card padding={false}>
      <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-amber-100 bg-amber-50 text-amber-600">
          <AlertTriangle
            className="size-4"
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Attention
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Capacity reductions and allocation risks within the planning horizon.
          </p>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm font-medium text-slate-700">
            No availability risks
          </p>

          <p className="mt-1 text-xs text-slate-500">
            No over-allocation or capacity reductions require attention in this planning horizon.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {visible.map(
            (item) => (
              <div
                key={`${item.employeeId}-${item.monthKey}-${item.type}`}
                className="flex items-center justify-between gap-4 px-5 py-3.5"
              >
                <div className="min-w-0">
                  <Link
                    to={`/resources/${encodeURIComponent(
                      item.employeeId,
                    )}`}
                    className="rounded text-xs font-semibold text-slate-900 outline-none hover:text-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600"
                  >
                    {
                      item.employeeName
                    }
                  </Link>

                  <p className="mt-1 truncate text-[10px] text-slate-500">
                    {
                      item.primaryCapability
                    }
                    {" · "}
                    {item.grade}
                    {" · "}
                    {formatMonth(
                      item.monthKey,
                    )}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <ArrowDownRight
                      className="size-3 text-amber-600"
                      aria-hidden="true"
                    />

                    <p className="text-xs font-semibold text-slate-700">
                      {getDescription(
                        item,
                      )}
                    </p>
                  </div>

                  {item.currentAvailableHours <
                    0 && (
                    <p className="mt-1 text-[10px] font-medium text-red-600">
                      {formatHours(
                        item.currentAvailableHours,
                      )}{" "}
                      available
                    </p>
                  )}
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </Card>
  );
}