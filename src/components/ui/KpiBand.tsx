import type { ReactNode } from "react";

import type { AvailabilityStatus } from "../../api/types";
import { EMPTY, integer } from "../../lib/format";
import { STATUS_STYLE } from "../../lib/status";
import { StatusChip } from "./primitives";
import { Tooltip } from "./Tooltip";

/**
 * KPI band for the dashboard control deck: one flat surface, groups side by side on wide screens,
 * each group a short label and a row of figures. No per-figure boxes, so the whole band sits in a
 * single row on desktop and stays shorter than a stack of cards.
 */
export function KpiBand({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="rv-kpi-band" role="group" aria-label={label}>
      {children}
    </div>
  );
}

export function KpiGroup({
  title,
  aside,
  columns,
  span,
  children,
}: {
  title: string;
  /** Right side of the group label: a total, a small distribution bar, or both. */
  aside?: ReactNode;
  columns: number;
  /** Relative width of the group on wide screens (defaults to its column count). */
  span?: number;
  children: ReactNode;
}) {
  return (
    <section
      className="rv-kpi-group"
      style={{ "--rv-kpi-cols": columns, "--rv-kpi-span": span ?? columns } as React.CSSProperties}
    >
      <header className="rv-kpi-group__head">
        <h3 className="rv-kpi-group__title">{title}</h3>
        {aside ? <div className="rv-kpi-group__aside">{aside}</div> : null}
      </header>
      <dl className="rv-kpi-group__stats">{children}</dl>
    </section>
  );
}

export function KpiStat({
  label,
  value,
  status,
  caption,
  loading = false,
}: {
  label: string;
  value: number | null | undefined;
  status?: AvailabilityStatus;
  caption?: ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="rv-kpi-stat">
      <dt className="rv-kpi-stat__label" title={label}>
        {status ? <StatusChip status={status} /> : null}
        <span className="truncate">{label}</span>
      </dt>
      <dd className="rv-kpi-stat__value">
        {loading ? <span aria-hidden="true" className="skeleton block h-6 w-14" /> : value == null ? EMPTY : integer(value)}
      </dd>
      {caption != null ? <dd className="rv-kpi-stat__caption">{loading ? null : caption}</dd> : null}
    </div>
  );
}

/** Thin stacked bar of status shares; the figures beside it carry the exact values. */
export function KpiDistribution({
  segments,
  label,
}: {
  segments: { status: AvailabilityStatus; value: number }[];
  label: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) return null;
  return (
    <span className="rv-kpi-distribution" role="img" aria-label={label}>
      {segments
        .filter((s) => s.value > 0)
        .map((s) => (
          <Tooltip key={s.status} content={`${s.status}: ${integer(s.value)}`}>
            <span
              className="rv-kpi-distribution__seg"
              style={{ flexGrow: s.value, backgroundColor: STATUS_STYLE[s.status].chart }}
            />
          </Tooltip>
        ))}
    </span>
  );
}
