import type { CSSProperties } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CHART_AXIS, CHART_AXIS_TITLE, CHART_CURSOR, CHART_FONT, CHART_GRID } from "../../lib/chart";
import { compactMonth, integer } from "../../lib/format";

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
}

export interface ChartMonth {
  month: number;
  label: string;
  has_data: boolean;
  total: number | null;
  values: Record<string, number | null>;
}

interface Props {
  title: string;
  months: ChartMonth[];
  series: ChartSeries[];
}

interface TooltipProps {
  active?: boolean;
  payload?: { payload: ChartMonth & Record<string, unknown> }[];
  series: ChartSeries[];
}

function ChartTooltip({ active, payload, series }: TooltipProps) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="min-w-52 rounded-lg bg-surface px-3 py-2.5 text-xs shadow-(--shadow-popover)">
      <p className="mb-1.5 font-medium text-ink">{row.label}</p>
      {!row.has_data ? (
        <p className="text-muted">No Project Track data for this month</p>
      ) : (
        <>
          {[...series].reverse().map((s) => (
            <p key={s.key} className="flex items-center justify-between gap-6 py-0.5">
              <span className="flex items-center gap-2 text-ink-soft">
                <span aria-hidden="true" className="inline-block h-2 w-2 rounded-sm" style={{ background: s.color }} />
                {s.label}
              </span>
              <span className="font-medium tabular-nums text-ink">{integer(row.values[s.key] ?? 0)}</span>
            </p>
          ))}
          <p className="mt-1.5 flex justify-between border-t border-hairline pt-1.5 font-medium text-ink">
            <span>Employees</span>
            <span className="tabular-nums">{integer(row.total)}</span>
          </p>
        </>
      )}
    </div>
  );
}

/** Stacked monthly employee counts. Months without data stay empty (blank), never zero. */
export function MonthlyStackedChart({ title, months, series }: Props) {
  const data = months.map((m) => ({
    ...m,
    short: compactMonth(m.month),
    ...Object.fromEntries(series.map((s) => [s.key, m.has_data ? (m.values[s.key] ?? 0) : undefined])),
    totalLine: m.has_data ? m.total : undefined,
  }));

  return (
    <figure aria-label={title} className="m-0">
      <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-soft">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </li>
        ))}
      </ul>
      {/* Below 640px every month keeps a readable slot and the chart scrolls sideways. */}
      <div className="overflow-x-auto overscroll-x-contain" aria-hidden="true">
      <div
        className="h-60 min-w-(--chart-min) sm:h-64 sm:min-w-0"
        style={{ "--chart-min": `${Math.max(320, months.length * 36 + 64)}px` } as CSSProperties}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 20, right: 8, bottom: 20, left: 4 }}>
            <CartesianGrid vertical={false} {...CHART_GRID} />
            <XAxis
              dataKey="short"
              tick={CHART_AXIS}
              tickLine={false}
              axisLine={{ stroke: "var(--color-border)" }}
              interval={0}
              angle={-40}
              textAnchor="end"
              height={52}
              label={{ value: "Reporting month", position: "bottom", offset: 4, style: CHART_AXIS_TITLE }}
            />
            <YAxis
              allowDecimals={false}
              tick={CHART_AXIS}
              axisLine={false}
              tickLine={false}
              width={48}
              label={{
                value: "Employees",
                angle: -90,
                position: "insideLeft",
                offset: 12,
                style: { ...CHART_AXIS_TITLE, textAnchor: "middle" },
              }}
            />
            <Tooltip content={<ChartTooltip series={series} />} cursor={CHART_CURSOR} />
            {series.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                stackId="employees"
                fill={s.color}
                stroke="var(--color-surface)"
                strokeWidth={1}
                isAnimationActive={false}
                maxBarSize={28}
                radius={0}
              />
            ))}
            <Line dataKey="totalLine" stroke="none" dot={false} activeDot={false} isAnimationActive={false}>
              <LabelList
                dataKey="totalLine"
                position="top"
                fontSize={10}
                fontWeight={500}
                fill="var(--color-ink-soft)"
                fontFamily={CHART_FONT}
              />
            </Line>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th>Month</th>
            {series.map((s) => (
              <th key={s.key}>{s.label}</th>
            ))}
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {months.map((m) => (
            <tr key={m.month}>
              <td>{m.label}</td>
              {series.map((s) => (
                <td key={s.key}>{m.has_data ? integer(m.values[s.key] ?? 0) : "No data"}</td>
              ))}
              <td>{m.has_data ? integer(m.total) : "No data"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
