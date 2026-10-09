import type { AvailabilityTimingResult } from "../../services/availabilityTimingService";

interface AvailabilityTimingStatusProps {
  result: AvailabilityTimingResult | null;
  showHours?: boolean;
}

const STATUS_LABELS = {
  AVAILABLE_BY_START: "Available by Start",
  PARTIALLY_AVAILABLE_BY_START: "Partially Available by Start",
  NOT_AVAILABLE_BY_START: "Not Available by Start",
} as const;

const STATUS_STYLES = {
  AVAILABLE_BY_START: "border-emerald-100 bg-emerald-50 text-emerald-700",

  PARTIALLY_AVAILABLE_BY_START: "border-blue-100 bg-blue-50 text-blue-700",

  NOT_AVAILABLE_BY_START: "border-slate-200 bg-slate-50 text-slate-600",
} as const;

export function AvailabilityTimingStatus({
  result,
  showHours = false,
}: AvailabilityTimingStatusProps) {
  if (result === null) {
    return (
      <span className="text-xs text-slate-400">
        Outside known planning horizon
      </span>
    );
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <span
        className={`inline-flex rounded-md border px-2 py-1 text-[11px] font-medium ${STATUS_STYLES[result.status]}`}
        title={result.explanation}
      >
        {STATUS_LABELS[result.status]}
      </span>

      {showHours && (
        <span className="text-[11px] tabular-nums text-slate-500">
          {result.availableHours.toLocaleString("en-US")}h{" · "}
          Monthly estimate
        </span>
      )}
    </div>
  );
}
