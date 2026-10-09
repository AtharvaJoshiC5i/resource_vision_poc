import { Activity, CircleGauge, Gauge, Percent } from "lucide-react";

import type { ResourceMonthlyRecord } from "../../types/resourceMonthly";

import { RESOURCE_STATUS_PRESENTATION } from "../../types/resourceDetail";

import { formatHours, formatPercentage } from "../../utils/formatters";

import { Badge } from "../ui/Badge";

interface ResourceSnapshotProps {
  snapshot: ResourceMonthlyRecord | null;
}

interface SnapshotCardProps {
  label: string;
  value: string;
  icon: typeof Gauge;
  negative?: boolean;
}

function SnapshotCard({
  label,
  value,
  icon: Icon,
  negative = false,
}: SnapshotCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>

          <p
            className={`mt-2 text-2xl font-semibold tracking-tight ${
              negative ? "text-red-700" : "text-slate-900"
            }`}
          >
            {value}
          </p>
        </div>

        <div className="flex size-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
          <Icon className="size-4.5 text-slate-500" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

export function ResourceSnapshot({ snapshot }: ResourceSnapshotProps) {
  if (snapshot === null) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-semibold text-slate-900">
          September 2026 snapshot
        </p>

        <p className="mt-1 text-sm text-slate-500">
          This employee does not have an applicable normalized record for
          September 2026.
        </p>
      </div>
    );
  }

  const status = RESOURCE_STATUS_PRESENTATION[snapshot.availability_status];

  const negative = snapshot.available_capacity < 0;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold text-slate-900">
          September 2026 Snapshot
        </h2>

        <Badge variant="blue">Planned · Project Track</Badge>

        <Badge variant={status.variant}>{status.label}</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SnapshotCard
          label="Total Capacity"
          value={formatHours(snapshot.total_capacity)}
          icon={Gauge}
        />

        <SnapshotCard
          label="Utilized Capacity"
          value={formatHours(snapshot.utilized_capacity)}
          icon={Activity}
        />

        <SnapshotCard
          label="Available Capacity"
          value={formatHours(snapshot.available_capacity)}
          icon={CircleGauge}
          negative={negative}
        />

        <SnapshotCard
          label="Availability"
          value={formatPercentage(snapshot.availability_percentage)}
          icon={Percent}
          negative={negative}
        />
      </div>
    </section>
  );
}
