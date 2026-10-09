import { useMemo, useState } from "react";

import {
  Activity,
  BriefcaseBusiness,
  CircleGauge,
  Gauge,
  Users,
} from "lucide-react";

import { resourceMonthlyRecords, unassignedDemand } from "../../data";

import {
  getCapabilityAvailability,
  getCapacityOutlook,
  getMonthlyAvailabilityTrend,
  getMonthlyUnassignedDemand,
  getOverviewSnapshot,
  POC_MONTH_OPTIONS,
} from "../../services/overviewService";

import { POC_CURRENT_MONTH } from "../../constants/poc";

import {
  formatHours,
  formatLongMonth,
  formatMonth,
  formatPercentage,
} from "../../utils/formatters";

import { pageMetadata } from "../config/navigation";

import { AvailabilityTrendChart } from "../overview/AvailabilityTrendChart";
import { CapabilityAvailabilityList } from "../overview/CapabilityAvailabilityList";
import { CapacityOutlookTable } from "../overview/CapacityOutlookTable";
import { MetricCard } from "../overview/MetricCard";
import { UnassignedDemandTable } from "../overview/UnassignedDemandTable";

import { Badge } from "../ui/Badge";
import { PageHeader } from "../ui/PageHeader";

export function OverviewPage() {
  const [selectedMonth, setSelectedMonth] = useState<string>(POC_CURRENT_MONTH);

  const snapshot = useMemo(
    () =>
      getOverviewSnapshot(
        resourceMonthlyRecords,
        unassignedDemand,
        selectedMonth,
      ),
    [selectedMonth],
  );

  const capabilityAvailability = useMemo(
    () => getCapabilityAvailability(resourceMonthlyRecords, selectedMonth),
    [selectedMonth],
  );

  const monthlyDemand = useMemo(
    () => getMonthlyUnassignedDemand(unassignedDemand, selectedMonth),
    [selectedMonth],
  );

  const trend = useMemo(
    () => getMonthlyAvailabilityTrend(resourceMonthlyRecords),
    [],
  );

  const capacityOutlook = useMemo(
    () => getCapacityOutlook(resourceMonthlyRecords),
    [],
  );

  const isHistorical = selectedMonth < POC_CURRENT_MONTH;

  const sourceLabel = isHistorical
    ? "Actual · Famstack"
    : "Planned · Project Track";

  return (
    <div className="space-y-6">
      <PageHeader
        title={pageMetadata.overview.title}
        description="Organization-wide resource capacity and availability outlook."
        actions={
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <label
              htmlFor="overview-month"
              className="text-xs font-medium text-slate-500"
            >
              Snapshot month
            </label>

            <select
              id="overview-month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="min-w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {POC_MONTH_OPTIONS.map((monthKey) => (
                <option key={monthKey} value={monthKey}>
                  {formatMonth(monthKey)}
                </option>
              ))}
            </select>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-700">
          {formatLongMonth(selectedMonth)}
        </span>

        <Badge variant={isHistorical ? "neutral" : "blue"}>{sourceLabel}</Badge>
      </div>

      <section
        aria-label="Resource capacity summary"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"
      >
        <MetricCard
          title="Total Capacity"
          value={formatHours(snapshot.totalCapacity)}
          supportingText={`${snapshot.activeResourceCount} active resources`}
          icon={Gauge}
        />

        <MetricCard
          title="Utilized Capacity"
          value={formatHours(snapshot.utilizedCapacity)}
          supportingText={`${formatPercentage(
            snapshot.utilizationPercentage,
          )} utilized`}
          icon={Activity}
        />

        <MetricCard
          title="Available Capacity"
          value={formatHours(snapshot.availableCapacity)}
          supportingText={`${formatPercentage(
            snapshot.availabilityPercentage,
          )} available`}
          icon={CircleGauge}
          negative={snapshot.availableCapacity < 0}
        />

        <MetricCard
          title="Resources With Capacity"
          value={snapshot.availableResourceCount.toLocaleString("en-US")}
          supportingText={`of ${snapshot.activeResourceCount} active resources`}
          icon={Users}
        />

        <MetricCard
          title="Unassigned Demand"
          value={formatHours(snapshot.unassignedDemandHours)}
          supportingText={`across ${snapshot.unassignedDemandCount} ${
            snapshot.unassignedDemandCount === 1
              ? "requirement"
              : "requirements"
          }`}
          icon={BriefcaseBusiness}
        />
      </section>

      <AvailabilityTrendChart data={trend} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <CapabilityAvailabilityList data={capabilityAvailability} />

        <UnassignedDemandTable data={monthlyDemand} />
      </div>

      <CapacityOutlookTable data={capacityOutlook} />
    </div>
  );
}
