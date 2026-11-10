import type { ReactNode } from "react";

import { EM_DASH } from "../../lib/format";

/** Default body copy in a data cell. */
export const tableBodyText = "text-sm leading-5 text-ink-soft";

/** Secondary line (codes, captions). */
export const tableBodyMeta = "text-xs leading-4 text-muted";

/** Numbers that are not the row headline. */
export const tableBodyNumeric = "text-sm leading-5 tabular-nums text-ink-soft";

/** Counts, hours, totals. */
export const tableBodyNumericStrong = "text-sm font-medium leading-5 tabular-nums text-ink";

/** IDs and reference codes. */
export const tableBodyId = "text-xs leading-4 tabular-nums text-muted";

export const chipClass = "rv-chip";

export const metricPillClass = "rv-metric-pill";

/** Planned hours consumed vs monthly capacity (Employee directory allocation column). */
export function HoursMetricPill({
  consumed,
  capacity,
  title,
}: {
  consumed: string;
  capacity: string;
  title?: string;
}) {
  const label = title ?? `${consumed} of ${capacity} hours planned this month`;
  return (
    <span className={metricPillClass} title={label} aria-label={label}>
      <span className="font-medium text-ink">{consumed} h</span>
      <span className="font-normal text-muted">of</span>
      <span className="font-medium text-ink-soft">{capacity} h</span>
    </span>
  );
}

export function TableEmpty({ title }: { title?: string }) {
  return (
    <span className={`${chipClass} min-h-6 min-w-[1.75rem] justify-center text-muted`} title={title}>
      {EM_DASH}
    </span>
  );
}

export function TableText({
  children,
  title,
  className = "",
}: {
  children: ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <span className={`block min-w-0 max-w-[28rem] truncate ${tableBodyText} ${className}`} title={title ?? (typeof children === "string" ? children : undefined)}>
      {children}
    </span>
  );
}

export function TableNumeric({
  children,
  strong = false,
  className = "",
}: {
  children: ReactNode;
  strong?: boolean;
  className?: string;
}) {
  return <span className={`${strong ? tableBodyNumericStrong : tableBodyNumeric} ${className}`}>{children}</span>;
}

/** Right-aligned block for hour columns in matrices. */
export function TableHourCell({
  children,
  muted,
  title,
}: {
  children: ReactNode;
  muted?: boolean;
  title?: string;
}) {
  return (
    <span
      className={`inline-flex min-h-[1.75rem] min-w-[2.75rem] items-center justify-end rounded-md px-1.5 py-0.5 ${muted ? "text-muted" : tableBodyNumericStrong}`}
      title={title}
    >
      {children}
    </span>
  );
}

/** Trailing affordance column. */
export const tableRowActionClass =
  "flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors group-hover:bg-primary-soft group-hover:text-primary group-focus-within:bg-primary-soft group-focus-within:text-primary";
