import type {
  ResourceDimension,
  ResourceFilters,
} from "../../types/resourceFilters";

interface ActiveFilterSummaryProps {
  filters: ResourceFilters;

  onRemoveDimensionValue: (
    dimension: ResourceDimension,

    value: string,
  ) => void;

  onClearStatus: () => void;

  onClearSearch: () => void;

  onClearAll: () => void;
}

const DIMENSION_LABELS: Record<ResourceDimension, string> = {
  primaryCapability: "Primary",

  secondaryCapability: "Secondary",

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

export function ActiveFilterSummary({
  filters,
  onRemoveDimensionValue,
  onClearStatus,
  onClearSearch,
  onClearAll,
}: ActiveFilterSummaryProps) {
  const dimensionValues = DIMENSIONS.flatMap((dimension) =>
    filters[dimension].map((value) => ({
      dimension,
      value,
    })),
  );

  const total =
    dimensionValues.length +
    filters.availabilityStatus.length +
    (filters.search.trim() !== "" ? 1 : 0);

  if (total === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs font-medium text-slate-500">
        {total} {total === 1 ? "filter" : "filters"} active
      </span>

      {dimensionValues.map(({ dimension, value }) => (
        <button
          key={`${dimension}-${value}`}
          type="button"
          onClick={() => onRemoveDimensionValue(dimension, value)}
          title={`Remove ${DIMENSION_LABELS[dimension]} filter: ${value}`}
          className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600 outline-none hover:border-slate-300 hover:bg-white focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          {value} ×
        </button>
      ))}

      {filters.availabilityStatus.map((status) => (
        <button
          key={status}
          type="button"
          onClick={onClearStatus}
          className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600 outline-none hover:bg-white focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          {status.replaceAll("_", " ").toLowerCase()} ×
        </button>
      ))}

      {filters.search.trim() !== "" && (
        <button
          type="button"
          onClick={onClearSearch}
          className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600 outline-none hover:bg-white focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          Search: {filters.search} ×
        </button>
      )}

      <button
        type="button"
        onClick={onClearAll}
        className="ml-1 rounded px-1.5 py-1 text-[11px] font-medium text-blue-700 outline-none hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-600"
      >
        Clear all
      </button>
    </div>
  );
}
