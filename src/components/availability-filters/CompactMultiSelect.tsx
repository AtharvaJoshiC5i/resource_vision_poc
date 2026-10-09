import { Check, ChevronDown } from "lucide-react";

import { useEffect, useRef, useState } from "react";

import type { ResourceFilterOption } from "../../types/resourceFilters";

interface CompactMultiSelectProps {
  label: string;

  options: ResourceFilterOption[];

  selected: string[];

  onChange: (values: string[]) => void;
}

export function CompactMultiSelect({
  label,
  options,
  selected,
  onChange,
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

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className={`inline-flex h-9 max-w-52 items-center gap-2 rounded-lg border px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 ${
          selected.length > 0
            ? "border-blue-200 bg-blue-50 text-blue-700"
            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        <span className="truncate">{displayText}</span>

        <ChevronDown className="size-3.5 shrink-0" aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
          <div className="max-h-64 overflow-y-auto">
            {options.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-slate-400">
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
                    className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                          checked
                            ? "border-blue-600 bg-blue-600"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {checked && (
                          <Check
                            className="size-3 text-white"
                            aria-hidden="true"
                          />
                        )}
                      </span>

                      <span className="truncate text-xs text-slate-700">
                        {option.label}
                      </span>
                    </span>

                    <span className="shrink-0 text-[10px] tabular-nums text-slate-400">
                      {option.count}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {selected.length > 0 && (
            <div className="mt-1 border-t border-slate-100 pt-1">
              <button
                type="button"
                onClick={() => onChange([])}
                className="w-full rounded-md px-2.5 py-2 text-left text-xs font-medium text-blue-700 outline-none hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-600"
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
