import type {
  AvailabilityDimensionAggregate,
  ResourceDimension,
} from "../../types/resourceFilters";

import { formatHours, formatMonth } from "../../utils/formatters";

import { Card } from "../ui/Card";

interface AvailabilityDimensionSummaryProps {
  dimension: ResourceDimension;

  monthKey: string;

  rows: AvailabilityDimensionAggregate[];

  onDimensionChange: (dimension: ResourceDimension) => void;

  onSelectValue: (
    dimension: ResourceDimension,

    value: string,
  ) => void;
}

const DIMENSION_LABELS: Record<ResourceDimension, string> = {
  primaryCapability: "Primary Capability",

  secondaryCapability: "Secondary Capability",

  department: "Department",

  grade: "Grade",

  location: "Location",

  country: "Country",
};

const DIMENSIONS: ResourceDimension[] = [
  "primaryCapability",
  "secondaryCapability",
  "department",
  "grade",
  "location",
  "country",
];

export function AvailabilityDimensionSummary({
  dimension,
  monthKey,
  rows,
  onDimensionChange,
  onSelectValue,
}: AvailabilityDimensionSummaryProps) {
  return (
    <Card padding={false}>
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Availability by {DIMENSION_LABELS[dimension]}
          </h2>

          <p className="mt-1 text-xs text-slate-500">{formatMonth(monthKey)}</p>
        </div>

        <div>
          <label
            htmlFor="availability-group-by"
            className="mb-1 block text-[11px] font-medium text-slate-500"
          >
            Group by
          </label>

          <select
            id="availability-group-by"
            value={dimension}
            onChange={(event) =>
              onDimensionChange(event.target.value as ResourceDimension)
            }
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            {DIMENSIONS.map((item) => (
              <option key={item} value={item}>
                {DIMENSION_LABELS[item]}
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
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {DIMENSION_LABELS[dimension]}
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
              {rows.map((row) => (
                <tr key={row.key} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      onClick={() => onSelectValue(dimension, row.key)}
                      className="rounded text-left text-sm font-medium text-slate-800 outline-none hover:text-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600"
                    >
                      {row.key}
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
