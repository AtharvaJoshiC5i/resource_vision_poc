import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import { fieldClass, labelClass } from "./primitives";

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
}

interface MultiSelectProps {
  label: string;
  options: SelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
  /** Optional classes on the field label (defaults to labelClass). */
  labelClassName?: string;
  /** Optional classes on the trigger button (e.g. min-h-14 to pair with a tall adjacent control). */
  triggerClassName?: string;
}

/** Accessible multi-select. Nothing selected means "All". */
export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  disabled = false,
  labelClassName,
  triggerClassName,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const summary =
    selected.length === 0
      ? "All"
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? selected[0])
        : `${selected.length} selected`;

  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);

  return (
    <div ref={rootRef} className="relative min-w-0">
      <span className={labelClassName ?? labelClass}>{label}</span>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${label}: ${summary}`}
        onClick={() => setOpen((value) => !value)}
        className={`${fieldClass} flex items-center justify-between gap-2 text-left ${open ? "border-primary ring-2 ring-primary/15" : ""} ${triggerClassName ?? ""}`}
      >
        <span className={`truncate ${selected.length === 0 ? "text-ink-soft" : "font-medium text-ink"}`}>{summary}</span>
        <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-muted ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          id={panelId}
          role="group"
          aria-label={`${label} options`}
          className="absolute left-0 z-30 mt-1 w-full min-w-56 rounded-xl bg-surface p-1 shadow-(--shadow-popover)"
        >
          <div className="flex items-center justify-between border-b border-hairline px-2 pb-1.5 pt-1 text-xs">
            <button
              type="button"
              className="rounded px-1 py-0.5 font-medium text-primary hover:text-purple-indigo"
              onClick={() => onChange(options.map((o) => o.value))}
            >
              Select all
            </button>
            <button
              type="button"
              className="rounded px-1 py-0.5 font-medium text-muted hover:text-ink"
              onClick={() => onChange([])}
            >
              Clear
            </button>
          </div>
          <ul className="max-h-64 overflow-auto py-1">
            {options.length === 0 && <li className="px-2 py-2 text-sm text-muted">No options</li>}
            {options.map((option) => {
              const checked = selected.includes(option.value);
              return (
                <li key={option.value}>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-ink-soft hover:bg-canvas">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={checked}
                      onChange={() => toggle(option.value)}
                    />
                    <span
                      className={`grid h-4 w-4 shrink-0 place-items-center rounded border peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary ${
                        checked ? "border-primary bg-primary text-surface" : "border-border bg-surface"
                      }`}
                    >
                      {checked && <Check aria-hidden="true" className="h-3 w-3" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {option.hint && <span className="text-xs text-muted tabular-nums">{option.hint}</span>}
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={fieldClass}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
