import { useMemo } from "react";
import { UsersRound } from "lucide-react";

import type { AvailabilityOptions, AvailabilityOverview, AvailabilityStatus } from "../../api/types";
import { MultiSelect } from "../../components/ui/MultiSelect";
import { FilterCard, PageZones, SummarySection } from "../../components/layout/pageZones";
import {
  Card,
  ErrorBlock,
  KpiCard,
  LoadingBlock,
  PageHeader,
  SectionHeader,
} from "../../components/ui/primitives";
import { useApi } from "../../hooks/useApi";
import { useUrlFilters } from "../../hooks/useUrlFilters";
import { CONTRACT_CHART_COLOR, CONTRACT_ORDER, STATUS_ICON, STATUS_ORDER, STATUS_STYLE } from "../../lib/status";
import { MonthlyStackedChart, type ChartMonth } from "./MonthlyStackedChart";

const FILTER_KEYS = ["months", "cc", "division", "cap", "grade", "loc"];

type OverviewKpis = AvailabilityOverview["kpis"];

const STATUS_CARDS: { status: AvailabilityStatus; label: string; key: keyof OverviewKpis }[] = [
  { status: "Fully Available", label: "Fully available", key: "fully_available" },
  { status: "Partially Available", label: "Partially available", key: "partially_available" },
  { status: "Fully Committed", label: "Fully committed", key: "fully_committed" },
  { status: "Over-allocated", label: "Over-allocated", key: "over_allocated" },
  { status: "Unverified", label: "Unverified", key: "unverified" },
];

export function AvailabilityPage() {
  const url = useUrlFilters();

  const months = url.getAll("months");
  const contract = url.getAll("cc");
  const divisions = url.getAll("division");
  const capabilities = url.getAll("cap");
  const grades = url.getAll("grade");
  const locations = url.getAll("loc");

  const filterParams = useMemo(
    () => ({
      months,
      contract_category: contract,
      division: divisions,
      capability: capabilities,
      grade: grades,
      location: locations,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [url.params],
  );

  const options = useApi<AvailabilityOptions>("/availability/options");
  const overview = useApi<AvailabilityOverview>("/availability/overview", filterParams);

  const activeFilters = FILTER_KEYS.filter((key) => url.getAll(key).length > 0).length;
  const resetAll = () => url.reset();

  const statusMonths: ChartMonth[] = (overview.data?.months ?? []).map((m) => ({
    month: m.month,
    label: m.label,
    has_data: m.has_data,
    total: m.total,
    values: m.statuses,
  }));
  const contractMonths: ChartMonth[] = (overview.data?.months ?? []).map((m) => ({
    month: m.month,
    label: m.label,
    has_data: m.has_data,
    total: m.total,
    values: m.contracts,
  }));
  const kpis = overview.data?.kpis;

  return (
    <PageZones>
      <PageHeader
        title="Availability"
        subtitle="Planned effort from Project Track across the reporting window. This is planned allocation, not actual utilization."
      />

      <SummarySection
        id="availability-summary-heading"
        subtitle="Distinct employees across the full reporting window. An employee who changes status between months is counted under each status they had. Reporting month affects the charts below, not these totals."
        footnote="Unverified covers zero-effort records, records needing review and employees without an HR match."
      >
        {overview.error ? (
          <ErrorBlock message={overview.error} onRetry={overview.reload} />
        ) : (
          <div className="@container">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-6">
              <KpiCard
                label="Employees with records"
                value={kpis?.employees_with_records}
                icon={UsersRound}
                loading={!kpis}
              />
              {STATUS_CARDS.map(({ status, label, key }) => (
                <KpiCard
                  key={status}
                  label={label}
                  value={kpis?.[key]}
                  status={status}
                  icon={STATUS_ICON[status]}
                  loading={!kpis}
                />
              ))}
            </div>
          </div>
        )}
      </SummarySection>

      <FilterCard
        filterCount={activeFilters}
        filterTotal={FILTER_KEYS.length}
        subtitle={
          activeFilters > 0
            ? "KPI totals above always use the full reporting window. Filters here scope the trend charts."
            : "Showing all employees in the reporting window"
        }
        onReset={resetAll}
        resetDisabled={activeFilters === 0}
      >
        <div className="@container">
        <div role="group" aria-label="Filters" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <MultiSelect
            label="Reporting month"
            options={(options.data?.months ?? []).map((m) => ({
              value: String(m.key),
              label: m.label,
              hint: m.has_data ? undefined : "No data",
            }))}
            selected={months}
            onChange={(values) => url.setValues({ months: values })}
          />
          <MultiSelect
            label="Contract category"
            options={CONTRACT_ORDER.map((c) => ({ value: c, label: c }))}
            selected={contract}
            onChange={(values) => url.setValues({ cc: values })}
          />
          <MultiSelect
            label="Division"
            options={(options.data?.divisions ?? []).map((v) => ({ value: v, label: v }))}
            selected={divisions}
            onChange={(values) => url.setValues({ division: values })}
          />
          <MultiSelect
            label="Primary capability"
            options={(options.data?.capabilities ?? []).map((v) => ({ value: v, label: v }))}
            selected={capabilities}
            onChange={(values) => url.setValues({ cap: values })}
          />
          <MultiSelect
            label="Grade"
            options={(options.data?.grades ?? []).map((v) => ({ value: v, label: v }))}
            selected={grades}
            onChange={(values) => url.setValues({ grade: values })}
          />
          <MultiSelect
            label="Location"
            options={(options.data?.locations ?? []).map((v) => ({ value: v, label: v }))}
            selected={locations}
            onChange={(values) => url.setValues({ loc: values })}
          />
        </div>
        </div>
      </FilterCard>

      <section aria-labelledby="availability-trends-heading">
        <SectionHeader
          id="availability-trends-heading"
          title="Trends"
          subtitle="Monthly distribution of the filtered population"
        />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card title="Employees by availability status">
            {overview.error ? null : !overview.data ? (
              <LoadingBlock height={320} label="Loading availability chart" />
            ) : (
              <MonthlyStackedChart
                title="Employees by availability status per month"
                months={statusMonths}
                series={STATUS_ORDER.map((s) => ({ key: s, label: s, color: STATUS_STYLE[s].chart }))}
              />
            )}
          </Card>
          <Card title="Employees by contract category">
            {overview.error ? null : !overview.data ? (
              <LoadingBlock height={320} label="Loading contract chart" />
            ) : (
              <MonthlyStackedChart
                title="Employees by contract category per month"
                months={contractMonths}
                series={CONTRACT_ORDER.map((c) => ({ key: c, label: c, color: CONTRACT_CHART_COLOR[c] }))}
              />
            )}
          </Card>
        </div>
      </section>
    </PageZones>
  );
}
