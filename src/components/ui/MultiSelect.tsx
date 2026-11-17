import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { remPx } from "../../lib/viewport";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Plus, Search, X } from "lucide-react";

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
  /** `field`: labelled form control. `pill`: compact toolbar filter button (see FilterBar). */
  variant?: "field" | "pill";
  /** Single choice uses the same panel chrome as multi-select, with one active value at a time. */
  selectionMode?: "multiple" | "single";
  /** When `selected` is empty in single mode, treat this option as active (e.g. "All Projects"). */
  baselineValue?: string;
}

/** Lists longer than this get a type-to-filter box at the top of the panel. */
const SEARCH_THRESHOLD = 8;
/** Gap between trigger and panel, and the margin kept from the viewport edge. */
const PANEL_GAP = 6;
const VIEWPORT_MARGIN = 12;
/** Tallest the option list grows before it scrolls. */
const LIST_MAX = 288;

interface PanelPlacement {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxList: number;
  above: boolean;
}

function SelectOptionCopy({ label, hint, emphasized }: { label: string; hint?: string; emphasized?: boolean }) {
  if (!hint) {
    return <span className={`min-w-0 flex-1 truncate ${emphasized ? "font-medium" : ""}`}>{label}</span>;
  }
  return (
    <span className="min-w-0 flex-1">
      <span className={`block leading-5 ${emphasized ? "font-medium text-ink" : ""}`}>{label}</span>
      <span className="mt-0.5 block text-xs leading-snug text-muted">{hint}</span>
    </span>
  );
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
  variant = "field",
  selectionMode = "multiple",
  baselineValue,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [placement, setPlacement] = useState<PanelPlacement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  // Last non-empty option list, so an open panel doesn't empty while options refetch. Updated during
  // render (React's "store info from previous renders" pattern) rather than in a ref.
  const [stableOptions, setStableOptions] = useState(options);
  const panelId = useId();
  if (options.length > 0 && options !== stableOptions) setStableOptions(options);
  const effectiveOptions = options.length > 0 ? options : stableOptions;
  const searchable = effectiveOptions.length > SEARCH_THRESHOLD;

  // Fixed and portaled to <body>: an open panel floats over the page instead of growing it.
  // It opens downward, and flips above the trigger when there isn't room below.
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const place = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const chrome = (searchable ? 92 : 48) + 8;
      const below = window.innerHeight - rect.bottom - PANEL_GAP - VIEWPORT_MARGIN;
      const above = rect.top - PANEL_GAP - VIEWPORT_MARGIN;
      const flip =
        variant !== "pill" && below < Math.min(LIST_MAX, 200) + chrome && above > below;
      const room = flip ? above : below;
      const width = Math.max(rect.width, remPx(256));
      const anchorLeft = variant === "pill" ? rect.right - width : rect.left;
      const left = Math.max(VIEWPORT_MARGIN, Math.min(anchorLeft, window.innerWidth - width - VIEWPORT_MARGIN));
      setPlacement({
        left,
        width,
        top: flip ? undefined : rect.bottom + PANEL_GAP,
        bottom: flip ? window.innerHeight - rect.top + PANEL_GAP : undefined,
        maxList: Math.max(120, Math.min(remPx(LIST_MAX), room - chrome)),
        above: flip,
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, searchable, variant]);

  // A control that becomes disabled closes its panel (adjusted during render, not in an effect).
  if (disabled && open) setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("click", onOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Focus the filter box once, when the panel first appears, so typing narrows the list at once.
  const placed = placement !== null;
  useEffect(() => {
    if (open && placed && searchable) searchRef.current?.focus({ preventScroll: true });
  }, [open, placed, searchable]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return effectiveOptions;
    return effectiveOptions.filter((o) => o.label.toLowerCase().includes(needle));
  }, [effectiveOptions, query]);

  const summary =
    selected.length === 0
      ? "All"
      : selected.length === 1
        ? (effectiveOptions.find((o) => o.value === selected[0])?.label ?? selected[0])
        : `${selected.length} selected`;

  const isOptionActive = (value: string) =>
    selected.includes(value) ||
    (selectionMode === "single" && selected.length === 0 && baselineValue !== undefined && value === baselineValue);

  const toggle = (value: string) => {
    if (selectionMode === "single") {
      if (selected.includes(value) || (selected.length === 0 && value === baselineValue)) {
        onChange([]);
      } else {
        onChange([value]);
      }
      setOpenState(false);
      buttonRef.current?.focus();
      return;
    }
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  const selectVisible = () => {
    if (selectionMode === "single") {
      const first = visible[0];
      if (first) onChange([first.value]);
      return;
    }
    onChange([...new Set([...selected, ...visible.map((o) => o.value)])]);
  };

  const setOpenState = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery("");
      setPlacement(null);
    }
  };

  const pillSummary =
    selected.length === 1
      ? (effectiveOptions.find((o) => o.value === selected[0])?.label ?? selected[0])
      : `${selected.length} selected`;

  const fieldTrigger = (
    <>
      <span className={labelClassName ?? labelClass}>{label}</span>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${label}: ${summary}`}
        onClick={() => setOpenState(!open)}
        className={`${fieldClass} flex items-center justify-between gap-2 text-left ${
          open
            ? "border-primary bg-surface shadow-(--shadow-focus)"
            : selected.length > 0
              ? "border-primary/40 bg-surface"
              : ""
        } ${triggerClassName ?? ""}`}
      >
        <span className={`truncate ${selected.length === 0 ? "text-ink-soft" : "font-medium text-ink"}`}>{summary}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          {selected.length > 1 ? (
            <span className="grid h-4.5 min-w-4.5 place-items-center rounded-full bg-primary px-1 text-[0.6875rem] font-medium leading-none tabular-nums text-surface">
              {selected.length}
            </span>
          ) : null}
          <ChevronDown
            aria-hidden="true"
            className={`h-4 w-4 text-muted transition-transform duration-200 ${open ? "rotate-180 text-primary" : ""}`}
          />
        </span>
      </button>
    </>
  );

  // Toolbar filter: a compact button that names the filter. Once set it turns tinted, shows the
  // chosen value inline and gets its own clear control, so every applied filter stays visible
  // and removable without reopening the menu.
  const active = selected.length > 0;
  const pillTrigger = (
    <span
      className={`inline-flex h-8 max-w-[18rem] items-center rounded-lg border text-xs font-medium transition-colors touch:h-10 ${
        active
          ? "border-primary/30 bg-primary-soft/60 text-ink"
          : `border-dashed bg-surface text-ink-soft hover:border-border hover:bg-canvas/60 hover:text-ink ${
              open ? "border-primary/50" : "border-card-border"
            }`
      } ${open ? "shadow-(--shadow-focus)" : ""}`}
    >
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={active ? `${label}: ${pillSummary}. Change filter` : `Filter by ${label.toLowerCase()}`}
        onClick={() => setOpenState(!open)}
        className={`inline-flex h-full min-w-0 items-center gap-1.5 rounded-lg disabled:opacity-40 ${active ? "pl-2.5 pr-1.5" : "px-2.5"}`}
      >
        {active ? null : <Plus aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted" />}
        <span className={`shrink-0 ${active ? "text-ink-soft" : ""}`}>{label}</span>
        {active ? (
          <>
            <span aria-hidden="true" className="h-3.5 w-px shrink-0 bg-primary/25" />
            <span className="min-w-0 truncate text-purple-indigo">{pillSummary}</span>
          </>
        ) : null}
        <ChevronDown
          aria-hidden="true"
          className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {active ? (
        <button
          type="button"
          onClick={() => onChange([])}
          aria-label={`Clear ${label.toLowerCase()} filter`}
          className="mr-1 grid h-5 w-5 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-primary/10 hover:text-ink touch:h-8 touch:w-8"
        >
          <X aria-hidden="true" className="h-3 w-3" />
        </button>
      ) : null}
    </span>
  );

  return (
    <div ref={rootRef} className={variant === "pill" ? "relative inline-flex min-w-0" : "relative min-w-0"}>
      {variant === "pill" ? pillTrigger : fieldTrigger}

      {open && placement && createPortal(
        <div
          ref={panelRef}
          id={panelId}
          role="group"
          aria-label={`${label} options`}
          data-rv-ms-panel=""
          onMouseDown={(event) => {
            if ((event.target as HTMLElement).closest("input, textarea")) return;
            event.preventDefault();
          }}
          style={{ top: placement.top, bottom: placement.bottom, left: placement.left, width: placement.width, zIndex: 120 }}
          className={`rv-popover fixed flex flex-col overflow-hidden rounded-xl bg-surface shadow-(--shadow-popover) ${
            placement.above ? "origin-bottom-left" : "origin-top-left"
          }`}
        >
          {searchable ? (
            <div className="border-b border-hairline p-1.5">
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
                />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={`Search ${label.toLowerCase()}`}
                  aria-label={`Search ${label}`}
                  className="h-8 w-full rounded-lg border border-transparent bg-canvas pl-8 pr-2.5 text-sm text-ink placeholder:text-muted focus:border-primary/40 focus:bg-surface focus:outline-none touch:h-10 touch:text-[1rem]"
                />
              </div>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-2 border-b border-hairline px-3 py-1.5 text-xs">
            <span className="tabular-nums text-muted">
              {selectionMode === "single"
                ? selected.length > 0 || baselineValue !== undefined
                  ? `1 of ${effectiveOptions.length} selected`
                  : `${effectiveOptions.length} options`
                : selected.length > 0
                  ? `${selected.length} of ${effectiveOptions.length} selected`
                  : `${effectiveOptions.length} options`}
            </span>
            <span className="flex items-center gap-0.5">
              {selectionMode === "multiple" ? (
                <button
                  type="button"
                  className="rounded-md px-1.5 py-1 font-medium text-primary hover:bg-primary-soft disabled:text-muted disabled:hover:bg-transparent touch:px-2 touch:py-2.5"
                  disabled={visible.length === 0}
                  onClick={selectVisible}
                >
                  {query ? "Select matches" : "Select all"}
                </button>
              ) : null}
              <button
                type="button"
                className="rounded-md px-1.5 py-1 font-medium text-muted hover:bg-canvas hover:text-ink disabled:hover:bg-transparent disabled:hover:text-muted touch:px-2 touch:py-2.5"
                disabled={selected.length === 0}
                onClick={() => onChange([])}
              >
                Clear
              </button>
            </span>
          </div>
          <ul className="rv-scroll overflow-auto p-1" style={{ maxHeight: placement.maxList }}>
            {visible.length === 0 && (
              <li className="px-2.5 py-6 text-center text-sm text-muted">
                {effectiveOptions.length === 0 ? "No options" : `No ${label.toLowerCase()} matches "${query.trim()}"`}
              </li>
            )}
            {visible.map((option) => {
              const checked = isOptionActive(option.value);
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() => toggle(option.value)}
                    className={`flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors touch:py-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                      checked ? "text-ink hover:bg-primary-soft/70" : "text-ink-soft hover:bg-canvas"
                    }`}
                  >
                    <span
                      className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-sm border transition-colors ${
                        checked ? "border-primary bg-primary text-surface" : "border-border bg-surface"
                      }`}
                    >
                      {checked && <Check aria-hidden="true" className="h-3 w-3" strokeWidth={2.5} />}
                    </span>
                    <SelectOptionCopy label={option.label} hint={option.hint} emphasized={checked} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>,
        document.body,
      )}
    </div>
  );
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  variant = "field",
  defaultValue,
  disabled = false,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** `pill` renders a compact toolbar filter that matches MultiSelect's pill variant. */
  variant?: "field" | "pill";
  /** The "no filter" value; anything else shows the pill as active. */
  defaultValue?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<PanelPlacement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const place = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const chrome = 8;
      const below = window.innerHeight - rect.bottom - PANEL_GAP - VIEWPORT_MARGIN;
      const above = rect.top - PANEL_GAP - VIEWPORT_MARGIN;
      const flip = below < Math.min(LIST_MAX, 200) + chrome && above > below;
      const room = flip ? above : below;
      const width = Math.max(rect.width, remPx(256));
      const left = Math.min(rect.left, window.innerWidth - width - VIEWPORT_MARGIN);
      setPlacement({
        left: Math.max(VIEWPORT_MARGIN, left),
        width,
        top: flip ? undefined : rect.bottom + PANEL_GAP,
        bottom: flip ? window.innerHeight - rect.top + PANEL_GAP : undefined,
        maxList: Math.max(120, Math.min(remPx(LIST_MAX), room - chrome)),
        above: flip,
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  // A control that becomes disabled closes its panel (adjusted during render, not in an effect).
  if (disabled && open) setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("click", onOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const displayLabel = options.find((o) => o.value === value)?.label ?? value;
  const baseline = defaultValue ?? options[0]?.value ?? "";
  const active = value !== baseline;
  const setOpenState = (next: boolean) => {
    setOpen(next);
    if (!next) setPlacement(null);
  };

  const pick = (next: string) => {
    onChange(next);
    setOpenState(false);
    buttonRef.current?.focus();
  };

  const clear = () => {
    if (baseline) onChange(baseline);
    else if (options[0]) onChange(options[0].value);
  };

  const fieldTrigger = (
    <>
      <span className={labelClass}>{label}</span>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="listbox"
        aria-label={`${label}: ${displayLabel}`}
        onClick={() => setOpenState(!open)}
        className={`${fieldClass} flex items-center justify-between gap-2 text-left ${
          open
            ? "border-primary bg-surface shadow-(--shadow-focus)"
            : active
              ? "border-primary/40 bg-surface"
              : ""
        }`}
      >
        <span className={`truncate ${active ? "font-medium text-ink" : "text-ink-soft"}`}>{displayLabel}</span>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180 text-primary" : ""}`}
        />
      </button>
    </>
  );

  const pillTrigger = (
    <span
      className={`inline-flex h-8 max-w-[18rem] items-center rounded-lg border text-xs font-medium transition-colors touch:h-10 ${
        active
          ? "border-primary/30 bg-primary-soft/60 text-ink"
          : `border-dashed bg-surface text-ink-soft hover:border-border hover:bg-canvas/60 hover:text-ink ${
              open ? "border-primary/50" : "border-card-border"
            }`
      } ${open ? "shadow-(--shadow-focus)" : ""}`}
    >
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="listbox"
        aria-label={active ? `${label}: ${displayLabel}. Change filter` : `Filter by ${label.toLowerCase()}`}
        onClick={() => setOpenState(!open)}
        className={`inline-flex h-full min-w-0 items-center gap-1.5 rounded-lg disabled:opacity-40 ${active ? "pl-2.5 pr-1.5" : "px-2.5"}`}
      >
        {active ? null : <Plus aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted" />}
        <span className={`shrink-0 ${active ? "text-ink-soft" : ""}`}>{label}</span>
        {active ? (
          <>
            <span aria-hidden="true" className="h-3.5 w-px shrink-0 bg-primary/25" />
            <span className="min-w-0 truncate text-purple-indigo">{displayLabel}</span>
          </>
        ) : null}
        <ChevronDown
          aria-hidden="true"
          className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {active ? (
        <button
          type="button"
          onClick={clear}
          aria-label={`Clear ${label.toLowerCase()} filter`}
          className="mr-1 grid h-5 w-5 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-primary/10 hover:text-ink touch:h-8 touch:w-8"
        >
          <X aria-hidden="true" className="h-3 w-3" />
        </button>
      ) : null}
    </span>
  );

  return (
    <div ref={rootRef} className={variant === "pill" ? "relative inline-flex min-w-0" : "relative min-w-0"}>
      {variant === "pill" ? pillTrigger : fieldTrigger}

      {open && placement && createPortal(
        <div
          ref={panelRef}
          id={panelId}
          role="listbox"
          aria-label={`${label} options`}
          data-rv-ms-panel=""
          onMouseDown={(event) => event.preventDefault()}
          style={{ top: placement.top, bottom: placement.bottom, left: placement.left, width: placement.width, zIndex: 120 }}
          className={`rv-popover fixed flex flex-col overflow-hidden rounded-xl bg-surface shadow-(--shadow-popover) ${
            placement.above ? "origin-bottom-left" : "origin-top-left"
          }`}
        >
          <ul className="rv-scroll overflow-auto p-1" style={{ maxHeight: placement.maxList }}>
            {options.length === 0 && <li className="px-2.5 py-6 text-center text-sm text-muted">No options</li>}
            {options.map((option) => {
              const selected = option.value === value;
              return (
                <li key={option.value} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => pick(option.value)}
                    className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors touch:py-2.5 ${
                      selected ? "bg-primary-soft/70 font-medium text-ink" : "text-ink-soft hover:bg-canvas"
                    }`}
                  >
                    <span
                      className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                        selected ? "border-primary bg-primary text-surface" : "border-border bg-surface"
                      }`}
                      aria-hidden="true"
                    >
                      {selected ? <span className="h-1.5 w-1.5 rounded-full bg-surface" /> : null}
                    </span>
                    <SelectOptionCopy label={option.label} hint={option.hint} emphasized={selected} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>,
        document.body,
      )}
    </div>
  );
}
