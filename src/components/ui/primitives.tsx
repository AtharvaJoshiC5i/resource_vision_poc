import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";
import { useScrollEdges } from "../../hooks/useScrollEdges";
import { tableFrameClass, tableFrameNestedClass } from "./tableClasses";
import { CircleAlert, UserRoundX, type LucideIcon } from "lucide-react";

import type { AvailabilityStatus } from "../../api/types";
import { EM_DASH, integer } from "../../lib/format";
import { STATUS_STYLE } from "../../lib/status";

export const fieldClass =
  "h-8 touch:h-10 w-full rounded-lg border border-hairline bg-raised px-2.5 text-sm touch:text-[1rem] text-ink shadow-[inset_0_1px_0_color-mix(in_srgb,var(--color-surface)_80%,transparent)] placeholder:text-muted transition-[border-color,box-shadow,background-color] hover:border-border focus:border-primary focus:bg-surface focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-primary/12 disabled:bg-canvas disabled:text-muted disabled:shadow-none";

export const labelClass = "mb-1.5 block text-xs font-medium text-muted";

/** Secondary button: bordered, neutral. */
export const buttonClass =
  "inline-flex h-8 touch:h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-hairline bg-surface px-2.5 text-xs font-medium text-ink shadow-(--shadow-card) transition-[background-color,border-color,box-shadow] hover:border-border hover:bg-canvas active:shadow-none disabled:opacity-40 disabled:hover:bg-surface disabled:shadow-none";

/** Tertiary button: text only, for actions that sit inside a card header. */
export const quietButtonClass =
  "inline-flex h-8 touch:h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-xs font-medium text-primary transition-colors hover:bg-primary-soft hover:text-purple-indigo disabled:text-muted disabled:hover:bg-transparent";

/** In-card subsection label — sentence case, muted. */
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
      className={`rounded-xl border border-card-border bg-surface p-4 shadow-(--shadow-card) ring-1 ring-inset ring-ink/[0.05] sm:p-5 short:p-3 ${className}`}
    >
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div className="min-w-0">
            {title && (
              <h2 id={titleId} className="text-base font-medium leading-snug text-ink">
                {title}
              </h2>
            )}
            {subtitle && <p className="mt-0.5 max-w-3xl text-xs leading-relaxed text-muted">{subtitle}</p>}
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
}: {
  id?: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-2.5 flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
      <div className="min-w-0">
        <h2 id={id} className="text-base font-medium leading-snug text-ink">
          {title}
        </h2>
        {subtitle && <p className="text-xs leading-relaxed text-muted">{subtitle}</p>}
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

export function StatusBadge({ status }: { status: AvailabilityStatus }) {
  const style = STATUS_STYLE[status];
  return (
    <span
      title={status}
      className="inline-flex h-[1.375rem] max-w-full items-center gap-1 overflow-hidden whitespace-nowrap rounded-md pl-0.5 pr-1.5 text-xs font-medium"
      style={{ backgroundColor: style.bg, color: style.fg }}
    >
      <span
        aria-hidden="true"
        className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-sm bg-surface/70 text-[10px] font-semibold leading-none"
      >
        {style.letter}
      </span>
      <span className="truncate">{status}</span>
    </span>
  );
}

/** Month-by-month columns scaled to the series maximum. Null months show as a baseline tick. */
export function Sparkbars({ values, color }: { values: (number | null)[]; color: string }) {
  const bar = 4;
  const gap = 2;
  const height = 32;
  const width = Math.max(1, values.length * (bar + gap) - gap);
  const max = Math.max(0, ...values.filter((v): v is number => v !== null));
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-8 w-24 shrink-0"
      aria-hidden="true"
    >
      {values.map((v, i) => {
        const x = i * (bar + gap);
        if (v === null || max === 0) {
          return <rect key={i} x={x} y={height - 1} width={bar} height={1} fill="var(--color-border)" />;
        }
        const h = Math.max(1.5, (v / max) * height);
        return <rect key={i} x={x} y={height - h} width={bar} height={h} rx={1} fill={color} />;
      })}
    </svg>
  );
}

export type KpiTone = "primary" | "success" | "warning" | "error" | "lavender" | "neutral";

/**
 * Summary count in the same chrome as other inset panels. Icons are muted wayfinding only.
 * `status` / `tone` are accepted for call-site consistency but do not recolour the tile.
 */
export function KpiCard({
  label,
  value,
  unit,
  icon: Icon,
  tone = "primary",
  status,
  emphasis,
  caption,
  loading = false,
  selected = false,
  onClick,
}: {
  label: string;
  value: number | string | null | undefined;
  unit?: string;
  icon: LucideIcon;
  tone?: KpiTone;
  status?: AvailabilityStatus;
  emphasis?: string;
  caption?: ReactNode;
  loading?: boolean;
  selected?: boolean;
  onClick?: () => void;
}) {
  void tone;
  void status;
  const interactive = Boolean(onClick);
  const display = typeof value === "number" ? integer(value) : (value ?? EM_DASH);
  const showUnit = Boolean(unit) && display !== EM_DASH;
  const hasFooter = emphasis != null || caption != null;

  const shellClass = ["rv-kpi-card", hasFooter ? "rv-kpi-card--with-footer" : "", selected ? "rv-kpi-card--selected" : ""]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      <span title={label} className={`rv-kpi-card__label ${selected ? "text-ink-soft" : ""}`}>
        <Icon aria-hidden="true" className="rv-kpi-card__glyph" strokeWidth={1.75} />
        <span className="min-w-0 leading-snug">{label}</span>
      </span>

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
        className={`${shellClass} outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas`}
      >
        {content}
      </button>
    );
  }

  return <div className={shellClass}>{content}</div>;
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

export function Pill({
  children,
  bg,
  fg,
  wrap = false,
}: {
  children: ReactNode;
  bg: string;
  fg: string;
  /** Lets long values wrap inside narrow table columns. */
  wrap?: boolean;
}) {
  const style: CSSProperties = { backgroundColor: bg, color: fg };
  return (
    <span
      className={`rv-chip border-transparent shadow-none ${wrap ? "min-h-6 py-0.5 leading-4 break-words" : "h-6 whitespace-nowrap"}`}
      style={style}
    >
      {children}
    </span>
  );
}

/** HR master data not linked to ZingHR — inline note, not a competing pill. */
export function HrMatchFlag({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 text-xs leading-none text-muted ${className}`}
      title="Employee record is not matched to ZingHR"
    >
      <UserRoundX aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-warning-ink/80" strokeWidth={1.75} />
      <span className="min-w-0 truncate text-[11px] text-ink-soft">No HR match</span>
    </span>
  );
}

/** Contextual info flag for non-HR messages (e.g. filter scope). */
export function FlagBadge({ children }: { children: ReactNode }) {
  const title = typeof children === "string" ? children : undefined;
  return (
    <span
      className="inline-flex max-w-xs items-start gap-1.5 rounded-md bg-canvas px-2 py-1 text-xs leading-snug text-muted ring-1 ring-inset ring-hairline"
      title={title}
    >
      <CircleAlert aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={1.75} />
      <span className="min-w-0">{children}</span>
    </span>
  );
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
        className="flex h-10 items-center gap-6 border-b border-hairline bg-[var(--rv-table-header-bg)] px-4"
      >
        {Array.from({ length: columns }, (_, col) => (
          <span key={col} className="skeleton block h-2.5" style={{ width: `${col === 0 ? 16 : 7}%` }} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div
          key={row}
          aria-hidden="true"
          className="flex h-12 items-center gap-6 border-b border-hairline bg-surface px-4 last:border-b-0"
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
      className="flex gap-3 rounded-xl border border-error/25 bg-error-soft px-4 py-4 shadow-(--shadow-card) ring-1 ring-inset ring-error/10 sm:px-5"
    >
      <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-error-ink" />
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
    <div className="rounded-xl border border-dashed border-hairline bg-canvas/50 px-6 py-10 text-center text-sm text-muted">
      {message}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <header className="border-b border-hairline pb-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-medium leading-snug tracking-tight text-ink sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-muted sm:text-sm">{subtitle}</p>}
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
}: {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <nav
      aria-label="Pagination"
      className="rv-inset-panel mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted tabular-nums py-2.5"
    >
      <span>
        <span className="font-medium text-ink-soft">
          {integer(from)}&ndash;{integer(to)}
        </span>{" "}
        of {integer(total)} employees
      </span>
      <span className="flex items-center gap-2">
        <button type="button" className={buttonClass} disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Previous
        </button>
        <span aria-live="polite" className="min-w-24 text-center">
          Page {page} of {pages}
        </span>
        <button type="button" className={buttonClass} disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Next
        </button>
      </span>
    </nav>
  );
}

export function TableFrame({
  nested = false,
  className = "",
  children,
  ...rest
}: ComponentPropsWithoutRef<"div"> & { nested?: boolean }) {
  const ref = useScrollEdges();
  const frameClass = nested ? tableFrameNestedClass : tableFrameClass;
  return (
    <div ref={ref} className={[frameClass, className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </div>
  );
}

/** Trailing "open" chevron: appears on hover or keyboard focus, always visible on touch screens. */
export const rowChevronClass =
  "h-4 w-4 text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 touch:opacity-100";
