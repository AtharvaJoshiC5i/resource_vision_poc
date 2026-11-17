import type { ReactNode } from "react";
import { tableFrameClass } from "./tableClasses";
import { CircleAlert, SearchX, UserRoundX } from "lucide-react";

import { TablePagination } from "./TablePagination";

export { TablePagination } from "./TablePagination";

import type { AvailabilityStatus } from "../../api/types";
import { EMPTY, integer } from "../../lib/format";
import { STATUS_STYLE } from "../../lib/status";
import { Tooltip } from "./Tooltip";

export const fieldClass =
  "rv-field h-8 touch:h-10 w-full rounded-lg bg-surface px-2.5 text-sm touch:text-[1rem] text-ink placeholder:text-muted transition-[box-shadow,background-color] focus:outline-none focus-visible:outline-none disabled:bg-canvas disabled:text-muted disabled:shadow-none";

export const labelClass = "rv-field-label mb-1.5 block text-xs font-medium text-ink-soft";

/** Secondary button: bordered, neutral. */
export const buttonClass =
  "rv-btn-secondary inline-flex h-8 touch:h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-surface px-3 text-xs font-medium text-ink transition-[background-color,box-shadow,transform] hover:bg-canvas/70 active:translate-y-px active:shadow-none disabled:opacity-40 disabled:hover:bg-surface disabled:active:translate-y-0 disabled:shadow-none";

/** Tertiary button: text only, for actions that sit inside a card header. */
export const quietButtonClass =
  "inline-flex h-8 touch:h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-medium text-primary transition-colors hover:bg-primary-soft hover:text-purple-indigo disabled:text-muted disabled:hover:bg-transparent";

/** In-card subsection label: sentence case, muted. */
export const sectionEyebrowClass = "rv-eyebrow";

export const insetPanelClass = "rv-inset-panel";

/** Two-state (or more) view switcher, e.g. chart vs table. */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="rv-segmented">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className="rv-segmented__option"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Card({
  title,
  titleId,
  subtitle,
  actions,
  children,
  className = "",
}: {
  title?: string;
  /** Links `aria-labelledby` on a parent section to this card title. */
  titleId?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rv-card rv-frame rounded-xl p-4 sm:p-5 short:p-3 ${className}`}
    >
      {(title || actions) && (
        <header className="rv-card__header mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-2 compact-height:mb-3">
          <div className="min-w-0">
            {title && (
              <h2 id={titleId} className="rv-card__title text-base font-medium leading-snug text-ink">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="rv-card__subtitle mt-1 max-w-3xl text-xs leading-relaxed text-muted">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/** Heading for a group of cards that sit directly on the page canvas. */
export function SectionHeader({
  id,
  title,
  subtitle,
  actions,
  compact = false,
}: {
  id?: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`mb-2.5 flex flex-wrap items-end justify-between gap-x-3 gap-y-1 ${compact ? "rv-section-header--compact" : ""}`}
    >
      <div className="min-w-0">
        {title ? (
          <h2 id={id} className="rv-section-header__title text-base font-medium leading-snug text-ink">
            {title}
          </h2>
        ) : null}
        {subtitle && <p className="rv-section-header__subtitle mt-0.5 text-xs leading-relaxed text-muted">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

/** Status letter chip; the same mark is used in the matrix, legends, cards and badges. */
export function StatusChip({ status, size = "sm" }: { status: AvailabilityStatus; size?: "sm" | "md" }) {
  const style = STATUS_STYLE[status];
  const dims = size === "md" ? "h-6 w-6 text-xs" : "h-5 w-5 text-xs";
  return (
    <span
      aria-hidden="true"
      className={`inline-grid shrink-0 place-items-center rounded-md font-semibold leading-none ${dims}`}
      style={{ backgroundColor: style.bg, color: style.fg }}
    >
      {style.letter}
    </span>
  );
}

/**
 * Availability status badge: a neutral chip carrying the status letter tile (the product's status
 * mark) and the label. Colour lives only in the tile, so a column of badges stays calm to read.
 */
export function StatusBadge({ status }: { status: AvailabilityStatus }) {
  const style = STATUS_STYLE[status];
  return (
    <Tooltip content={status}>
      <span className="rv-tag rv-tag--status max-w-full overflow-hidden">
        <span
          aria-hidden="true"
          className="grid h-5 w-5 shrink-0 place-items-center rounded-[5px] text-[0.6875rem] font-semibold leading-none"
          style={{ backgroundColor: style.bg, color: style.fg }}
        >
          {style.letter}
        </span>
        <span className="truncate">{status}</span>
      </span>
    </Tooltip>
  );
}

export type KpiTone = "primary" | "success" | "warning" | "error" | "lavender" | "neutral";

/**
 * Summary count: a label, a figure and an optional footer. A status count carries the product's
 * status letter tile (the same mark as the matrix and legend); other counts carry no icon.
 * `tone` is accepted for call-site consistency and does not recolour the tile.
 */
export function KpiCard({
  label,
  value,
  unit,
  status,
  emphasis,
  caption,
  loading = false,
  selected = false,
  onClick,
  dense = false,
  className = "",
}: {
  label: string;
  value: number | string | null | undefined;
  unit?: string;
  tone?: KpiTone;
  status?: AvailabilityStatus;
  emphasis?: string;
  caption?: ReactNode;
  loading?: boolean;
  selected?: boolean;
  onClick?: () => void;
  dense?: boolean;
  className?: string;
}) {
  const interactive = Boolean(onClick);
  const display = typeof value === "number" ? integer(value) : (value ?? EMPTY);
  const showUnit = Boolean(unit) && display !== EMPTY;
  const hasFooter = emphasis != null || caption != null;

  const shellClass = [
    "rv-kpi-card",
    hasFooter ? "rv-kpi-card--with-footer" : "",
    dense ? "rv-kpi-card--dense" : "",
    selected ? "rv-kpi-card--selected" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const labelNode = (
    <span className={`rv-kpi-card__label ${selected ? "text-ink-soft" : ""}`}>
      {status ? <StatusChip status={status} /> : null}
      <span className="min-w-0 leading-snug">{label}</span>
    </span>
  );

  const content = (
    <>
      <Tooltip content={label}>{labelNode}</Tooltip>

      {loading ? (
        <div aria-hidden="true">
          <span className="skeleton rv-kpi-card__value block h-7 w-16" />
          {hasFooter && (
            <p className="rv-kpi-card__footer">
              <span className="skeleton block h-3 w-32" />
            </p>
          )}
        </div>
      ) : (
        <>
          <p className="rv-kpi-card__value flex items-baseline gap-1 whitespace-nowrap">
            <span>{display}</span>
            {showUnit && <span className="text-xs font-medium text-muted">{unit}</span>}
          </p>
          {hasFooter && (
            <p className="rv-kpi-card__footer truncate tabular-nums">
              {emphasis != null && <span className="text-ink-soft">{emphasis}</span>}
              {emphasis != null && caption != null && " "}
              {caption}
            </p>
          )}
        </>
      )}
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        data-status={status}
        className={`${shellClass} outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas`}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={shellClass} data-status={status}>
      {content}
    </div>
  );
}

export function InfoTile({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-ink">{value}</p>
    </div>
  );
}

/** Label above a value, for the stacked card lists that replace wide tables on phones. */
export function MetaField({ label, value, className = "" }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium tabular-nums text-ink-soft">{value}</dd>
    </div>
  );
}

/**
 * Category badge (e.g. project status): neutral chip with a coloured dot, after Untitled UI's
 * "modern" badge. `fg` colours the dot; `bg` is kept for call-site compatibility.
 */
export function Pill({
  children,
  fg,
  wrap = false,
}: {
  children: ReactNode;
  bg?: string;
  fg: string;
  /** Lets long values wrap inside narrow table columns. */
  wrap?: boolean;
}) {
  return (
    <span
      className={`rv-tag max-w-full ${wrap ? "rv-tag--wrap" : "rv-tag--nowrap"}`}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: fg }} />
      {children}
    </span>
  );
}

/** HR master data not linked to ZingHR: inline note, not a competing pill. */
export function HrMatchFlag({ className = "" }: { className?: string }) {
  return (
    <Tooltip content="Employee record is not matched to ZingHR">
      <span
        className={`inline-flex max-w-full items-center gap-1 text-xs leading-none text-muted ${className}`}
      >
        <UserRoundX aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-warning-ink/80" strokeWidth={1.75} />
        <span className="min-w-0 truncate text-[0.6875rem] text-ink-soft">No HR match</span>
      </span>
    </Tooltip>
  );
}

/** Contextual info flag for non-HR messages (e.g. filter scope). */
export function FlagBadge({ children }: { children: ReactNode }) {
  const hint = typeof children === "string" ? children : undefined;
  const badge = (
    <span className="inline-flex max-w-xs items-start gap-1.5 text-xs leading-snug text-muted">
      <CircleAlert aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={1.75} />
      <span className="min-w-0">{children}</span>
    </span>
  );
  if (!hint) return badge;
  return <Tooltip content={hint}>{badge}</Tooltip>;
}

/** Loading state shaped like the table it stands in for: header row, then rows of cell bars. */
export function TableSkeleton({
  rows = 8,
  columns = 6,
  label = "Loading table",
}: {
  rows?: number;
  columns?: number;
  label?: string;
}) {
  // Deterministic widths so the placeholder does not jitter between renders.
  const width = (row: number, col: number) => (col === 0 ? 28 : 8 + ((row * 7 + col * 13) % 9));
  return (
    <div role="status" aria-live="polite" aria-label={label} className={tableFrameClass}>
      <div
        aria-hidden="true"
        className="flex h-11 items-center gap-6 border-b border-card-border bg-surface px-4"
      >
        {Array.from({ length: columns }, (_, col) => (
          <span key={col} className="skeleton block h-2.5" style={{ width: `${col === 0 ? 16 : 7}%` }} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div
          key={row}
          aria-hidden="true"
          className="flex h-13 items-center gap-6 border-b border-hairline bg-surface px-4 last:border-b-0"
        >
          {Array.from({ length: columns }, (_, col) => (
            <span key={col} className="skeleton block h-3" style={{ width: `${width(row, col)}%` }} />
          ))}
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function LoadingBlock({ height = 160, label = "Loading data" }: { height?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-label={label}>
      <div className="skeleton w-full" style={{ height }} />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex gap-3 rounded-xl border border-error/20 bg-error-soft/70 px-4 py-4 sm:px-5"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface text-error-ink shadow-(--shadow-control)">
        <CircleAlert aria-hidden="true" className="h-4 w-4" />
      </span>
      <div className="min-w-0 text-sm">
        <p className="font-medium text-ink">Data could not be loaded</p>
        <p className="mt-0.5 break-words text-ink-soft">{message}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className={`${buttonClass} mt-3`}>
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

export function EmptyBlock({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-card-border bg-canvas/40 px-6 py-12 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-canvas text-muted">
        <SearchX aria-hidden="true" className="h-4.5 w-4.5" />
      </span>
      <p className="max-w-sm text-sm text-ink-soft">{message}</p>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  children,
  compact = false,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  compact?: boolean;
}) {
  return (
    <header
      className={`rv-page-header rv-rule-b pb-4 compact-height:pb-3 ${compact ? "rv-page-header--compact" : ""}`}
    >
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between lg:gap-4 compact-height:gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="rv-page-header__title text-xl font-semibold leading-snug text-ink sm:text-2xl compact-height:text-lg">
            {title}
          </h1>
          {subtitle && (
            <p
              className={`rv-page-header__subtitle mt-1 max-w-2xl text-xs leading-relaxed text-muted sm:text-sm`}
            >
              {subtitle}
            </p>
          )}
        </div>
        {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
      </div>
    </header>
  );
}

export function Pagination({
  page,
  pages,
  total,
  pageSize,
  onChange,
  itemLabel = "employees",
}: {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
  itemLabel?: string;
}) {
  return <TablePagination page={page} pages={pages} total={total} pageSize={pageSize} onChange={onChange} itemLabel={itemLabel} />;
}

/** Trailing "open" chevron: always visible (hover-only actions hide the next step), stronger on hover. */
export const rowChevronClass = "h-4 w-4 transition-colors";
