import { CalendarDays, Plus, RotateCcw, X } from "lucide-react";

import { useMemo, useState } from "react";

import { compareMonthKeys } from "../../services/monthService";

import { formatMonth } from "../../utils/formatters";

import { PlanningHorizonControl } from "../availability-overview/PlanningHorizonControl";

const MAX_CUSTOM_MONTHS = 4;

interface ResourceMatrixMonthControlsProps {
  customViewEnabled: boolean;

  onCustomViewEnabledChange: (enabled: boolean) => void;

  /** Consecutive planning window (default view). */
  planningStartMonth: string;

  planningMonthCount: number;

  onPlanningStartMonthChange: (startMonth: string) => void;

  canGoPlanningPrevious: boolean;

  canGoPlanningNext: boolean;

  customMonthKeys: string[];

  availableMonthKeys: string[];

  onCustomMonthKeysChange: (monthKeys: string[]) => void;

  onResetToPlanningPeriod: () => void;
}

function sortMonthKeys(monthKeys: string[]): string[] {
  return [...monthKeys].sort(compareMonthKeys);
}

export function ResourceMatrixMonthControls({
  customViewEnabled,
  onCustomViewEnabledChange,
  planningStartMonth,
  planningMonthCount,
  onPlanningStartMonthChange,
  canGoPlanningPrevious,
  canGoPlanningNext,
  customMonthKeys,
  availableMonthKeys,
  onCustomMonthKeysChange,
  onResetToPlanningPeriod,
}: ResourceMatrixMonthControlsProps) {
  const [pickerValue, setPickerValue] = useState("");

  const sortedCustom = useMemo(
    () => sortMonthKeys(customMonthKeys),
    [customMonthKeys],
  );

  const addableMonths = useMemo(
    () =>
      availableMonthKeys.filter(
        (monthKey) => !sortedCustom.includes(monthKey),
      ),
    [availableMonthKeys, sortedCustom],
  );

  const atMax = sortedCustom.length >= MAX_CUSTOM_MONTHS;

  function handleAdd(monthKey: string) {
    if (monthKey === "" || sortedCustom.includes(monthKey) || atMax) {
      return;
    }

    onCustomMonthKeysChange(sortMonthKeys([...sortedCustom, monthKey]));
    setPickerValue("");
  }

  function handleRemove(monthKey: string) {
    if (sortedCustom.length <= 1) {
      return;
    }

    onCustomMonthKeysChange(
      sortedCustom.filter((candidate) => candidate !== monthKey),
    );
  }

  function handleEnableCustom() {
    onCustomViewEnabledChange(true);
  }

  return (
    <div className="flex w-full max-w-2xl flex-col items-end gap-2">
      {customViewEnabled ? (
        <div className="flex w-full flex-col items-end gap-2">
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <div className="mr-1 hidden items-center gap-1.5 text-slate-500 sm:flex">
              <CalendarDays className="size-3.5" aria-hidden="true" />

              <span className="text-[11px] font-medium uppercase tracking-wide">
                Custom months
              </span>
            </div>

            {sortedCustom.map((monthKey) => (
              <span
                key={monthKey}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-sm"
              >
                {formatMonth(monthKey)}

                <button
                  type="button"
                  onClick={() => handleRemove(monthKey)}
                  disabled={sortedCustom.length <= 1}
                  aria-label={`Remove ${formatMonth(monthKey)}`}
                  className="rounded p-0.5 text-slate-400 outline-none hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </span>
            ))}

            {!atMax && addableMonths.length > 0 && (
              <label className="relative inline-flex h-8 items-center">
                <span className="sr-only">Add month to matrix</span>

                <Plus
                  className="pointer-events-none absolute left-2.5 size-3.5 text-slate-400"
                  aria-hidden="true"
                />

                <select
                  value={pickerValue}
                  onChange={(event) => handleAdd(event.target.value)}
                  className="h-8 cursor-pointer appearance-none rounded-md border border-dashed border-slate-300 bg-slate-50/80 pl-8 pr-7 text-xs font-medium text-slate-600 outline-none transition-colors hover:border-slate-400 hover:bg-white focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5"
                >
                  <option value="">Add month</option>

                  {addableMonths.map((monthKey) => (
                    <option key={monthKey} value={monthKey}>
                      {formatMonth(monthKey)}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <button
              type="button"
              onClick={onResetToPlanningPeriod}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-sm outline-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <RotateCcw className="size-3.5 text-slate-500" aria-hidden="true" />
              Reset
            </button>
          </div>

          <p className="text-[11px] text-slate-500">
            {sortedCustom.length} of {MAX_CUSTOM_MONTHS} custom months · Reset
            returns to the standard planning period
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <PlanningHorizonControl
            startMonth={planningStartMonth}
            numberOfMonths={planningMonthCount}
            onChange={onPlanningStartMonthChange}
            canGoPrevious={canGoPlanningPrevious}
            canGoNext={canGoPlanningNext}
          />

          <button
            type="button"
            onClick={handleEnableCustom}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm outline-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            Customize months
          </button>
        </div>
      )}
    </div>
  );
}
