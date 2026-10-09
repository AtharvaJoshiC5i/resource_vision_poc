import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { MonthlyAvailabilityTrendItem } from "../../services/overviewService";

import {
  formatHours,
  formatMonth,
  formatMonthShort,
  formatPercentage,
} from "../../utils/formatters";

import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";

interface AvailabilityTrendChartProps {
  data: MonthlyAvailabilityTrendItem[];
}

interface TooltipPayloadItem {
  payload: MonthlyAvailabilityTrendItem;
}

interface TrendTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}

function TrendTooltip({ active, payload }: TrendTooltipProps) {
  if (!active || payload === undefined || payload.length === 0) {
    return null;
  }

  const item = payload[0].payload;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-sm font-semibold text-slate-900">
        {formatMonth(item.monthKey)}
      </p>

      <div className="mt-2 space-y-1 text-xs text-slate-600">
        <p>
          Availability:{" "}
          <span className="font-medium text-slate-900">
            {formatPercentage(item.availabilityPercentage)}
          </span>
        </p>

        <p>
          Available:{" "}
          <span className="font-medium text-slate-900">
            {formatHours(item.availableCapacity)}
          </span>
        </p>

        <p>
          Total capacity:{" "}
          <span className="font-medium text-slate-900">
            {formatHours(item.totalCapacity)}
          </span>
        </p>

        <p>
          Source:{" "}
          <span className="font-medium text-slate-900">
            {item.source === "FAMSTACK"
              ? "Actual · Famstack"
              : "Planned · Project Track"}
          </span>
        </p>
      </div>
    </div>
  );
}

export function AvailabilityTrendChart({ data }: AvailabilityTrendChartProps) {
  const minimumAvailability =
    data.length === 0
      ? 0
      : Math.min(...data.map((item) => item.availabilityPercentage));

  const yMinimum =
    minimumAvailability < 0 ? Math.floor(minimumAvailability / 10) * 10 : 0;

  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Availability Trend
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Historical actuals and current/future planned availability across
            2026.
          </p>
        </div>

        <Badge variant="neutral">Jan – Dec 2026</Badge>
      </div>

      <div
        className="mt-6 h-80 w-full"
        aria-label="Monthly organization availability trend for 2026"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{
              top: 10,
              right: 12,
              left: -12,
              bottom: 0,
            }}
          >
            <CartesianGrid
              stroke="#e2e8f0"
              strokeDasharray="3 3"
              vertical={false}
            />

            <XAxis
              dataKey="monthKey"
              tickFormatter={formatMonthShort}
              tick={{
                fill: "#64748b",
                fontSize: 12,
              }}
              axisLine={{
                stroke: "#cbd5e1",
              }}
              tickLine={false}
            />

            <YAxis
              domain={[yMinimum, 100]}
              tickFormatter={(value) => `${value}%`}
              tick={{
                fill: "#64748b",
                fontSize: 12,
              }}
              axisLine={false}
              tickLine={false}
              width={48}
            />

            <Tooltip
              content={<TrendTooltip />}
              cursor={{
                stroke: "#cbd5e1",
                strokeWidth: 1,
              }}
            />

            <ReferenceLine
              x="2026-09"
              stroke="#94a3b8"
              strokeDasharray="4 4"
              label={{
                value: "Plan",
                position: "insideTopRight",
                fill: "#64748b",
                fontSize: 11,
              }}
            />

            <Line
              type="monotone"
              dataKey="availabilityPercentage"
              stroke="#2563eb"
              strokeWidth={2}
              dot={{
                r: 3,
                fill: "#ffffff",
                stroke: "#2563eb",
                strokeWidth: 2,
              }}
              activeDot={{
                r: 5,
              }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Jan – Aug
          </p>

          <p className="mt-1 text-sm font-medium text-slate-800">
            Historical Actual
          </p>

          <p className="text-xs text-slate-500">Famstack</p>
        </div>

        <div className="border-slate-200 sm:border-l sm:pl-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Sep – Dec
          </p>

          <p className="mt-1 text-sm font-medium text-slate-800">
            Current / Planned
          </p>

          <p className="text-xs text-slate-500">Project Track</p>
        </div>
      </div>
    </Card>
  );
}
