import { useId, useState, type ReactNode } from "react";
import { ChevronDown, ListFilter, Search, SlidersHorizontal, X } from "lucide-react";

/** Dashboard page rhythm: `rv-density` tightens type and spacing without clipping content. */
export function DashboardPage({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rv-density min-w-0 w-full space-y-3 md:space-y-4 ${className}`}>{children}</div>;
}

/** Primary tables, charts and matrices, on the same scroll as the rest of the page. */
export function DashboardBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`min-w-0 space-y-3 md:space-y-4 ${className}`}>{children}</div>;
}

/** Detail page header block (breadcrumb + profile card). */
export function DetailChrome({ children }: { children: ReactNode }) {
  return <div className="space-y-3 md:space-y-4">{children}</div>;
}

export function DetailBody({ children }: { children: ReactNode }) {
  return <div className="space-y-3 md:space-y-4">{children}</div>;
}

/** Compact search box for the filter bar. Sits first in the row, so typing is the quickest way in. */
export function FilterSearch({
  id,
  value,
  onChange,
  placeholder,
  label,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <div className="relative w-full sm:w-60">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
      />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="rv-field h-8 w-full rounded-lg bg-surface pl-8 pr-8 text-xs text-ink transition-[box-shadow] placeholder:text-muted focus:outline-none touch:h-10 touch:text-[1rem] [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-1.5 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-md text-muted transition-colors hover:bg-canvas hover:text-ink"
        >
          <X aria-hidden="true" className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
}

/**
 * Secondary filters in a full-width inset panel below the primary pill row. The panel stays open
 * while any additional filter is applied.
 */
export function MoreFilters({ activeCount, children }: { activeCount: number; children: ReactNode }) {
  const [openState, setOpen] = useState(false);
  const open = openState || activeCount > 0;
  const panelId = useId();
  const locked = activeCount > 0;

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        disabled={locked}
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors touch:h-10 ${
          open
            ? "border-primary/25 bg-primary-soft/50 text-ink shadow-(--shadow-control)"
            : "border-dashed border-card-border text-ink-soft hover:border-card-border hover:bg-surface hover:text-ink"
        } disabled:cursor-default disabled:border-primary/25 disabled:bg-primary-soft/35 disabled:text-ink disabled:opacity-100`}
      >
        <SlidersHorizontal aria-hidden="true" className={`h-3.5 w-3.5 ${open ? "text-primary" : "text-muted"}`} />
        {open ? "Hide additional filters" : "More filters"}
        {activeCount > 0 ? (
          <span className="grid h-4.5 min-w-4.5 place-items-center rounded-full bg-primary px-1 text-[11px] font-medium leading-none tabular-nums text-surface">
            {activeCount}
          </span>
        ) : (
          <ChevronDown aria-hidden="true" className={`h-3.5 w-3.5 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
        )}
      </button>
      {open ? (
        <div id={panelId} role="region" aria-label="Additional filters" className="rv-more-filters-panel">
          <div className="rv-more-filters-panel__row">
            <span className="rv-more-filters-panel__label">Additional</span>
            <div className="rv-more-filters-panel__chips">{children}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/**
 * Dashboard command surface, one card top to bottom: title, KPI band, then an always-visible
 * filter bar sitting directly above the content it scopes. Filters are compact buttons in one row (MultiSelect `variant="pill"`); each applied
 * filter shows its value and its own clear control, and "Clear all" resets the lot.
 */
export function DashboardControlDeck({
  pageTitle,
  pageSubtitle,
  metricsTitle = "Reporting window totals",
  footnote,
  kpis,
  filterCount = 0,
  filterNote,
  onReset,
  children,
}: {
  pageTitle?: string;
  pageSubtitle?: string;
  metricsTitle?: string;
  footnote?: ReactNode;
  kpis: ReactNode;
  filterCount?: number;
  /** One line under the filter bar explaining what the filters affect. */
  filterNote?: string;
  onReset?: () => void;
  children: ReactNode;
}) {
  const footnoteId = useId();
  const filtersId = useId();

  return (
    <section className="rv-control-deck rv-frame overflow-hidden rounded-xl">
      {pageTitle || pageSubtitle ? (
        <header className="rv-control-deck__header rv-rule-b px-4 pb-3.5 pt-4 sm:px-5">
          {pageTitle ? (
            <h1 className="rv-page-header__title text-lg font-semibold leading-snug text-ink sm:text-xl">
              {pageTitle}
            </h1>
          ) : null}
          {pageSubtitle ? (
            <p className="rv-page-header__subtitle mt-1 max-w-3xl text-xs leading-relaxed text-muted">
              {pageSubtitle}
            </p>
          ) : null}
        </header>
      ) : null}

      <div className="rv-control-deck__kpis" role="group" aria-label={metricsTitle}>
        {kpis}
      </div>

      <div className="rv-filter-bar px-4 py-2.5 sm:px-5">
        <div className="rv-filter-bar__stack flex flex-col gap-1.5">
          <div role="group" aria-labelledby={filtersId} className="rv-filter-bar__primary flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span id={filtersId} className="mr-0.5 inline-flex h-8 shrink-0 items-center gap-1.5 text-xs font-medium text-ink-soft">
              <ListFilter aria-hidden="true" className="h-4 w-4 text-muted" />
              Filters
              {filterCount > 0 ? (
                <span className="grid h-4.5 min-w-4.5 place-items-center rounded-full bg-primary px-1 text-[11px] font-medium leading-none tabular-nums text-surface">
                  {filterCount}
                </span>
              ) : null}
            </span>
            {children}
            {filterCount > 0 && onReset ? (
              <button
                type="button"
                onClick={onReset}
                className="ml-auto inline-flex h-8 shrink-0 items-center rounded-lg px-2.5 text-xs font-medium text-primary transition-colors hover:bg-primary-soft hover:text-purple-indigo touch:h-10 sm:ml-0"
              >
                Clear all
              </button>
            ) : null}
          </div>
          {filterNote ? (
            <p className="rv-control-deck__filter-note text-xs leading-snug text-muted sm:text-right">{filterNote}</p>
          ) : null}
        </div>
      </div>

      {footnote ? (
        <details className="rv-control-deck__footnote rv-rule-t group px-4 py-2 text-xs text-muted sm:px-5">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md py-0.5 text-xs font-medium text-muted transition-colors hover:text-ink-soft [&::-webkit-details-marker]:hidden">
            <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
            About these totals
          </summary>
          <p id={footnoteId} className="mt-1.5 max-w-4xl pb-1 leading-relaxed">
            {footnote}
          </p>
        </details>
      ) : null}
    </section>
  );
}
