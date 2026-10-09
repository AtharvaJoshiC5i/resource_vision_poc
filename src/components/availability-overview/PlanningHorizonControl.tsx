import { ChevronLeft, ChevronRight } from "lucide-react";

import { addMonths, getMonthRange } from "../../services/monthService";

import { formatMonth } from "../../utils/formatters";

interface PlanningHorizonControlProps {
  startMonth: string;
  numberOfMonths: number;

  onChange: (startMonth: string) => void;

  canGoPrevious?: boolean;
  canGoNext?: boolean;
}

export function PlanningHorizonControl({
  startMonth,
  numberOfMonths,
  onChange,
  canGoPrevious = true,
  canGoNext = true,
}: PlanningHorizonControlProps) {
  const months = getMonthRange(startMonth, numberOfMonths);

  const endMonth = months[months.length - 1];

  return (
    <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => onChange(addMonths(startMonth, -1))}
        disabled={!canGoPrevious}
        aria-label="Previous planning period"
        title="Previous planning period"
        className="flex size-9 items-center justify-center rounded-l-lg text-slate-500 outline-none transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
      </button>

      <div className="min-w-44 border-x border-slate-200 px-4 py-2 text-center">
        <p className="text-xs font-medium text-slate-700">
          {formatMonth(startMonth)}
          {" – "}
          {formatMonth(endMonth)}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onChange(addMonths(startMonth, 1))}
        disabled={!canGoNext}
        aria-label="Next planning period"
        title="Next planning period"
        className="flex size-9 items-center justify-center rounded-r-lg text-slate-500 outline-none transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
      >
        <ChevronRight className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
