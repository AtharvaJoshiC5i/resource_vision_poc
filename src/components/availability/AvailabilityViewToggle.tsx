import type { MatrixMetric } from "../../types/availabilityExplorer";

interface AvailabilityViewToggleProps {
  value: MatrixMetric;
  onChange: (value: MatrixMetric) => void;
}

const OPTIONS: {
  value: MatrixMetric;
  label: string;
}[] = [
  {
    value: "availabilityPercentage",
    label: "Availability %",
  },
  {
    value: "availableCapacity",
    label: "Available Hours",
  },
  {
    value: "utilizedCapacity",
    label: "Utilized Hours",
  },
];

export function AvailabilityViewToggle({
  value,
  onChange,
}: AvailabilityViewToggleProps) {
  return (
    <div
      className="inline-flex rounded-lg border border-slate-200 bg-white p-1"
      aria-label="Matrix metric"
    >
      {OPTIONS.map((option) => {
        const active = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={`rounded-md px-3 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 ${
              active
                ? "bg-blue-50 text-blue-700"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
