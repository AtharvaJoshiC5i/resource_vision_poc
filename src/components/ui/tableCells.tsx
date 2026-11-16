import type { ReactNode } from "react";

import { EMPTY } from "../../lib/format";
import { Tooltip } from "./Tooltip";

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
    <Tooltip content={label}>
      <span className={metricPillClass} aria-label={label}>
        <span className="font-medium text-ink">{consumed} h</span>
        <span className="font-normal text-muted">of</span>
        <span className="font-medium text-ink-soft">{capacity} h</span>
      </span>
    </Tooltip>
  );
}

/** Missing value: a quiet en dash with the reason on hover. No box, so empty cells recede. */
export function TableEmpty({ title: hint }: { title?: string }) {
  const label = hint ?? "No value";
  return (
    <Tooltip content={hint}>
      <span className="inline-block min-w-4 text-center text-border" aria-label={label}>
        {EMPTY}
      </span>
    </Tooltip>
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
  const hint = title ?? (typeof children === "string" ? children : undefined);
  const text = (
    <span className={`block min-w-0 max-w-[28rem] truncate ${tableBodyText} ${className}`}>{children}</span>
  );
  if (!hint) return text;
  return <Tooltip content={hint}>{text}</Tooltip>;
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
  const cell = (
    <span
      className={`inline-flex min-h-7 min-w-11 items-center justify-end rounded-md px-1.5 py-0.5 ${muted ? "text-muted" : tableBodyNumericStrong}`}
    >
      {children}
    </span>
  );
  if (!title) return cell;
  return <Tooltip content={title}>{cell}</Tooltip>;
}

/** Trailing affordance column. */
export const tableRowActionClass =
  "flex h-7 w-7 items-center justify-center rounded-md text-border transition-colors group-hover:bg-surface group-hover:text-primary group-hover:shadow-(--shadow-control) group-focus-within:text-primary";