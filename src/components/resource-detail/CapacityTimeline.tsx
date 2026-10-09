import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ResourceMonthlyRecord } from "../../types/resourceMonthly";

import { RESOURCE_STATUS_PRESENTATION } from "../../types/resourceDetail";

import {
  formatHours,
  formatLongMonth,
  formatMonthShort,
  formatPercentage,
} from "../../utils/formatters";

import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";

interface CapacityTimelineProps {
  records: ResourceMonthlyRecord[];
}

interface TimelineChartRow {
  monthKey: string;
  totalCapacity: number;
  utilizedCapacity: number;
  availableCapacity: number;
  availabilityPercentage: number;
  source: "FAMSTACK" | "PROJECT_TRACK";
  status: ResourceMonthlyRecord["availability_status"];
}

interface TooltipPayloadItem {
  payload: TimelineChartRow;
}

interface TimelineTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}

function TimelineTooltip({ active, payload }: TimelineTooltipProps) {
  if (!active || payload === undefined || payload.length === 0) {
    return null;
  }

  const item = payload[0].payload;

  const status = RESOURCE_STATUS_PRESENTATION[item.status];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-sm font-semibold text-slate-900">
        {formatLongMonth(item.monthKey)}
      </p>

      <p className="mt-1 text-xs text-slate-500">
        {item.source === "FAMSTACK"
          ? "Actual · Famstack"
          : "Planned · Project Track"}
      </p>

      <div className="mt-3 space-y-1.5 text-xs text-slate-600">
        <p>
          Total Capacity:{" "}
          <span className="font-medium text-slate-900">
            {formatHours(item.totalCapacity)}
          </span>
        </p>

        <p>
          Utilized Capacity:{" "}
          <span className="font-medium text-slate-900">
            {formatHours(item.utilizedCapacity)}
          </span>
        </p>

        <p>
          Available Capacity:{" "}
          <span
            className={
              item.availableCapacity < 0
                ? "font-medium text-red-700"
                : "font-medium text-slate-900"
            }
          >
            {formatHours(item.availableCapacity)}
          </span>
        </p>

        <p>
          Availability:{" "}
          <span
            className={
              item.availabilityPercentage < 0
                ? "font-medium text-red-700"
                : "font-medium text-slate-900"
            }
          >
            {formatPercentage(item.availabilityPercentage)}
          </span>
        </p>

        <p>
          Status:{" "}
          <span className="font-medium text-slate-900">{status.label}</span>
        </p>
      </div>
    </div>
  );
}

export function CapacityTimeline({ records }: CapacityTimelineProps) {
  const chartData: TimelineChartRow[] = records.map((record) => ({
    monthKey: record.month_key,

    totalCapacity: record.total_capacity,

    utilizedCapacity: record.utilized_capacity,

    availableCapacity: record.available_capacity,

    availabilityPercentage: record.availability_percentage,

    source: record.source,

    status: record.availability_status,
  }));

  return (
    <Card padding={false}>
      <div className="border-b border-slate-200 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Capacity Timeline
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Monthly capacity, utilization and availability across 2026.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral">Jan–Aug · Actual</Badge>

            <Badge variant="blue">Sep–Dec · Planned</Badge>
          </div>
        </div>
      </div>

      <div className="p-5">
        <div
          className="h-80 w-full"
          aria-label="Employee monthly capacity timeline"
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{
                top: 10,
                right: 16,
                bottom: 0,
                left: -8,
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
                tick={{
                  fill: "#64748b",
                  fontSize: 12,
                }}
                axisLine={false}
                tickLine={false}
                width={48}
              />

              <Tooltip
                content={<TimelineTooltip />}
                cursor={{
                  fill: "#f8fafc",
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

              <Bar
                dataKey="utilizedCapacity"
                name="Utilized Capacity"
                fill="#64748b"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />

              <Line
                type="monotone"
                dataKey="totalCapacity"
                name="Total Capacity"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{
                  r: 3,
                  fill: "#ffffff",
                  stroke: "#2563eb",
                  strokeWidth: 2,
                }}
                isAnimationActive={false}
              />

              <Line
                type="monotone"
                dataKey="availableCapacity"
                name="Available Capacity"
                stroke="#16a34a"
                strokeWidth={2}
                strokeDasharray="4 3"
                dot={{
                  r: 3,
                  fill: "#ffffff",
                  stroke: "#16a34a",
                  strokeWidth: 2,
                }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
          <span>Bar · Utilized Capacity</span>

          <span>Solid line · Total Capacity</span>

          <span>Dashed line · Available Capacity</span>
        </div>
      </div>

      <div className="overflow-x-auto border-t border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {[
                "Month",
                "Source",
                "Capacity",
                "Utilized",
                "Available",
                "Availability",
                "Status",
              ].map((heading) => (
                <th
                  key={heading}
                  scope="col"
                  className={`whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 ${
                    [
                      "Capacity",
                      "Utilized",
                      "Available",
                      "Availability",
                    ].includes(heading)
                      ? "text-right"
                      : "text-left"
                  }`}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 bg-white">
            {records.map((record) => {
              const status =
                RESOURCE_STATUS_PRESENTATION[record.availability_status];

              const planned = record.source === "PROJECT_TRACK";

              return (
                <tr
                  key={record.month_key}
                  className={planned ? "bg-blue-50/30" : ""}
                >
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                    {formatLongMonth(record.month_key)}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {planned ? "Planned" : "Actual"}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                    {formatHours(record.total_capacity)}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                    {formatHours(record.utilized_capacity)}
                  </td>

                  <td
                    className={`whitespace-nowrap px-4 py-3 text-right font-medium ${
                      record.available_capacity < 0
                        ? "text-red-700"
                        : "text-slate-700"
                    }`}
                  >
                    {formatHours(record.available_capacity)}
                  </td>

                  <td
                    className={`whitespace-nowrap px-4 py-3 text-right font-medium ${
                      record.availability_percentage < 0
                        ? "text-red-700"
                        : "text-slate-700"
                    }`}
                  >
                    {formatPercentage(record.availability_percentage)}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3">
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
