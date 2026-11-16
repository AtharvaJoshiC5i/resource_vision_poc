import type { AvailabilityOverview, AvailabilityStatus } from "../../api/types";
import { KpiBand, KpiGroup, KpiStat } from "./KpiBand";

type Kpis = AvailabilityOverview["kpis"];
type StatusKey = Exclude<keyof Kpis["employee_months"], "total">;

const STATUS_STATS: { status: AvailabilityStatus; label: string; key: StatusKey }[] = [
  { status: "Fully Available", label: "Fully available", key: "fully_available" },
  { status: "Partially Available", label: "Partially available", key: "partially_available" },
  { status: "Fully Committed", label: "Fully committed", key: "fully_committed" },
  { status: "Over-allocated", label: "Over-allocated", key: "over_allocated" },
  { status: "Unverified", label: "Unverified", key: "unverified" },
];

/**
 * Whole-organisation figures over the full reporting window: headcount (people) beside planned
 * employee-months by status (one count per employee in each month with Project Track data).
 */
export function OrgKpiStrip({ kpis }: { kpis: Kpis | undefined }) {
  const loading = !kpis;

  return (
    <KpiBand label="Reporting window totals">
      <KpiGroup title="Headcount" columns={3}>
        <KpiStat label="Total employees" value={kpis?.total_employees} loading={loading} />
        <KpiStat label="With records" value={kpis?.employees_with_records} loading={loading} />
        <KpiStat label="No record" value={kpis?.employees_without_records} loading={loading} />
      </KpiGroup>

      <KpiGroup title="Employee-months by status" columns={5}>
        {STATUS_STATS.map(({ status, label, key }) => (
          <KpiStat key={status} label={label} value={kpis?.employee_months?.[key]} status={status} loading={loading} />
        ))}
      </KpiGroup>
    </KpiBand>
  );
}
