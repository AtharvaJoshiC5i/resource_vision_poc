import type { CSSProperties, ReactNode } from "react";
import { CircleAlert, type LucideIcon } from "lucide-react";

import type { AvailabilityStatus } from "../../api/types";
import { EM_DASH, integer } from "../../lib/format";
import { STATUS_STYLE } from "../../lib/status";

export const fieldClass =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink placeholder:text-muted transition-colors hover:border-muted/60 focus:border-primary focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-primary/15 disabled:bg-canvas disabled:text-muted";

export const labelClass = "mb-1.5 block text-xs font-medium text-ink-soft";

/** Secondary button: bordered, neutral. */
export const buttonClass =
  "inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-surface px-3 text-[12px] font-medium text-ink transition-colors hover:bg-canvas disabled:opacity-40 disabled:hover:bg-surface";

/** Tertiary button: text only, for actions that sit inside a card header. */
export const quietButtonClass =
  "inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-[12px] font-medium text-primary transition-colors hover:bg-primary-soft hover:text-purple-indigo disabled:text-muted disabled:hover:bg-transparent";

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
    <section className={`rounded-xl border border-hairline bg-surface p-5 shadow-(--shadow-card) sm:p-6 ${className}`}>
      {(title || actions) && (
        <header className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            {title && (
              <h2 id={titleId} className="text-[15px] font-semibold leading-6 text-ink">
                {title}
              </h2>
            )}
            {subtitle && <p className="mt-0.5 max-w-3xl text-[12px] leading-5 text-muted">{subtitle}</p>}
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
    <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
      <div className="min-w-0">
        <h2 id={id} className="text-[15px] font-semibold leading-6 text-ink">
          {title}
        </h2>
        {subtitle && <p className="text-[12px] leading-5 text-muted">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

/** Status letter chip; the same mark is used in the matrix, legends, cards and badges. */
export function StatusChip({ status, size = "sm" }: { status: AvailabilityStatus; size?: "sm" | "md" }) {
  const style = STATUS_STYLE[status];
  const dims = size === "md" ? "h-6 w-6 text-xs" : "h-5 w-5 text-[11px]";
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
      className="inline-flex h-6 max-w-full items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-md pl-1 pr-2 text-xs font-medium"
      style={{ backgroundColor: style.bg, color: style.fg }}
    >
      <span
        aria-hidden="true"
        className="grid h-4 w-4 shrink-0 place-items-center rounded-sm bg-surface/70 text-[10px] font-semibold leading-none"
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

const KPI_TONE: Record<KpiTone, { bg: string; fg: string }> = {
  primary: { bg: "var(--color-primary-soft)", fg: "var(--color-primary)" },
  success: { bg: "var(--color-success-soft)", fg: "var(--color-success-ink)" },
  warning: { bg: "var(--color-warning-soft)", fg: "var(--color-warning-ink)" },
  error: { bg: "var(--color-error-soft)", fg: "var(--color-error-ink)" },
  lavender: { bg: "var(--color-lavender-soft)", fg: "var(--color-purple-indigo)" },
  neutral: { bg: "var(--color-canvas)", fg: "var(--color-ink-soft)" },
};

/**
 * Label and icon on top, the figure, then a footer line of context.
 * The icon tile takes the status colours when `status` is set, otherwise `tone`.
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
  /** Set smaller beside the figure, e.g. "h". */
  unit?: string;
  icon: LucideIcon;
  tone?: KpiTone;
  status?: AvailabilityStatus;
  /** Short figure at the start of the footer, e.g. "34%". */
  emphasis?: string;
  /** Rest of the footer line, e.g. "of employees". */
  caption?: ReactNode;
  loading?: boolean;
  /** With onClick the card is a filter toggle. */
  selected?: boolean;
  onClick?: () => void;
}) {
  const interactive = Boolean(onClick);
  const display = typeof value === "number" ? integer(value) : (value ?? EM_DASH);
  const showUnit = Boolean(unit) && display !== EM_DASH;
  const colors = status ? { bg: STATUS_STYLE[status].bg, fg: STATUS_STYLE[status].fg } : KPI_TONE[tone];
  const hasFooter = emphasis != null || caption != null;

  const content = (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className={`min-w-0 pt-1 text-[12.5px] font-medium leading-5 ${selected ? "text-ink" : "text-ink-soft"}`}>
          {label}
        </span>
        <span
          aria-hidden="true"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
          style={{ backgroundColor: colors.bg, color: colors.fg }}
        >
          <Icon className="h-4 w-4" strokeWidth={2} />
        </span>
      </span>

      {loading ? (
        <span className="mt-2 block" aria-hidden="true">
          <span className="skeleton block h-8 w-24" />
          <span className="mt-4 block border-t border-hairline pt-3">
            <span className="skeleton block h-3 w-32" />
          </span>
        </span>
      ) : (
        <>
          <span className="mt-2 block whitespace-nowrap text-[26px] font-semibold leading-8 tracking-tight tabular-nums text-ink">
            {display}
            {showUnit && <span className="ml-1 text-sm font-medium tracking-normal text-muted">{unit}</span>}
          </span>
          {hasFooter && (
            <span className="mt-auto block pt-4">
              <span className="block truncate border-t border-hairline pt-3 text-xs tabular-nums text-muted">
                {emphasis != null && <span className="font-semibold text-ink-soft">{emphasis}</span>}
                {emphasis != null && caption != null && " "}
                {caption}
              </span>
            </span>
          )}
        </>
      )}
    </>
  );

  const base = "flex h-full w-full min-w-0 flex-col rounded-xl border bg-surface p-4 text-left shadow-(--shadow-card)";

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        className={`${base} transition-colors ${
          selected ? "border-primary ring-1 ring-inset ring-primary" : "border-hairline hover:border-border"
        }`}
      >
        {content}
      </button>
    );
  }

  return <div className={`${base} border-hairline`}>{content}</div>;
}

export function InfoTile({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-ink">{value}</p>
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
      className={`inline-flex items-center rounded-md px-2 text-xs font-medium ${
        wrap ? "min-h-6 py-0.5 leading-4 break-words" : "h-6 whitespace-nowrap"
      }`}
      style={style}
    >
      {children}
    </span>
  );
}

/** Neutral badge for data-quality flags such as a missing HR match. */
export function FlagBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-5 items-center whitespace-nowrap rounded-md bg-warning-soft px-1.5 text-[11px] font-medium text-warning-ink">
      {children}
    </span>
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
    <div role="alert" className="flex gap-3 rounded-xl border border-error/25 bg-error-soft px-4 py-4 sm:px-5">
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
  return <div className="rounded-lg bg-canvas px-6 py-10 text-center text-sm text-muted">{message}</div>;
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
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold leading-8 tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
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
      className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[12px] text-muted tabular-nums"
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

export const tableHeadClass =
  "border-b border-hairline bg-canvas px-3 py-2.5 text-left text-xs font-medium whitespace-nowrap text-muted";
