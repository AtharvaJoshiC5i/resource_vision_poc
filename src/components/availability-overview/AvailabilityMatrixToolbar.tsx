import { Search } from "lucide-react";

import type { ResourceMatrixStatusFilter } from "../../types/resourceAvailabilityMatrix";

import { formatMonth } from "../../utils/formatters";

interface AvailabilityMatrixToolbarProps {
  search: string;

  status: ResourceMatrixStatusFilter;

  focusMonth: string;

  monthKeys: string[];

  onSearchChange: (value: string) => void;

  onStatusChange: (value: ResourceMatrixStatusFilter) => void;

  onFocusMonthChange: (monthKey: string) => void;
}

export function AvailabilityMatrixToolbar({
  search,
  status,
  focusMonth,
  monthKeys,
  onSearchChange,
  onStatusChange,
  onFocusMonthChange,
}: AvailabilityMatrixToolbarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-end">
      <div className="min-w-0 flex-1">
        <label
          htmlFor="resource-matrix-search"
          className="mb-1.5 block text-xs font-medium text-slate-600"
        >
          Search
        </label>

        <div className="relative max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />

          <input
            id="resource-matrix-search"
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search resources..."
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:flex lg:items-end">
        <div>
          <label
            htmlFor="resource-matrix-focus-month"
            className="mb-1.5 block text-xs font-medium text-slate-600"
          >
            Focus Month
          </label>

          <select
            id="resource-matrix-focus-month"
            value={focusMonth}
            onChange={(event) => onFocusMonthChange(event.target.value)}
            className="min-w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            {monthKeys.map((monthKey) => (
              <option key={monthKey} value={monthKey}>
                {formatMonth(monthKey)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="resource-matrix-status"
            className="mb-1.5 block text-xs font-medium text-slate-600"
          >
            Status
          </label>

          <select
            id="resource-matrix-status"
            value={status}
            onChange={(event) =>
              onStatusChange(event.target.value as ResourceMatrixStatusFilter)
            }
            className="min-w-44 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="ALL">All</option>

            <option value="WITH_CAPACITY">With Capacity</option>

            <option value="AVAILABLE">Available</option>

            <option value="PARTIALLY_AVAILABLE">Partially Available</option>

            <option value="FULLY_ALLOCATED">Fully Allocated</option>

            <option value="OVER_ALLOCATED">Over-Allocated</option>
          </select>
        </div>
      </div>
    </div>
  );
}
