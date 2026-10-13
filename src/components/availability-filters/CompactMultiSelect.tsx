import { Check, ChevronDown } from "lucide-react";

import { useEffect, useRef, useState } from "react";

import type { ResourceFilterOption } from "../../types/resourceFilters";

interface CompactMultiSelectProps {
  label: string;

  options: ResourceFilterOption[];

  selected: string[];

  onChange: (values: string[]) => void;

  /** When false, option counts are hidden (e.g. status filters). */
  showCounts?: boolean;
}

export function CompactMultiSelect({
  label,
  options,
  selected,
  onChange,
  showCounts = true,
}: CompactMultiSelectProps) {
  const [open, setOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current !== null &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);

    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function toggleValue(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));

      return;
    }

    onChange([...selected, value]);
  }

  const displayText =
    selected.length === 0
      ? label
      : selected.length === 1
        ? selected[0]
        : `${label} (${selected.length})`;

  const isActive = selected.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`inline-flex h-9 max-w-[13rem] items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-slate-900/10 ${
          isActive
            ? "border-slate-300 bg-slate-50 text-slate-900"
            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50/60"
        }`}
      >
        <span className="truncate">{displayText}</span>

        <ChevronDown
          className="size-3 shrink-0 text-slate-400"
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-60 rounded-md border border-slate-200 bg-white p-1 shadow-lg ring-1 ring-slate-900/5">
          <div className="max-h-60 overflow-y-auto">
            {options.length === 0 ? (
              <p className="px-2.5 py-3 text-center text-xs text-slate-500">
                No options
              </p>
            ) : (
              options.map((option) => {
                const checked = selected.includes(option.value);

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleValue(option.value)}
                    className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600/40"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={`flex size-3.5 shrink-0 items-center justify-center rounded border ${
                          checked
                            ? "border-slate-800 bg-slate-800"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {checked && (
                          <Check
                            className="size-2.5 text-white"
                            strokeWidth={3}
                            aria-hidden="true"
                          />
                        )}
                      </span>

                      <span className="truncate text-xs text-slate-700">
                        {option.label}
                      </span>
                    </span>

                    {showCounts && (
                      <span className="shrink-0 text-[10px] tabular-nums text-slate-400">
                        {option.count.toLocaleString("en-US")}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {selected.length > 0 && (
            <div className="mt-0.5 border-t border-slate-100 pt-0.5">
              <button
                type="button"
                onClick={() => onChange([])}
                className="w-full rounded px-2 py-1.5 text-left text-xs font-medium text-slate-600 outline-none hover:bg-slate-50 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-600/40"
              >
                Clear {label}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
