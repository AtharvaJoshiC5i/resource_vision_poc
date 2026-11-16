import { useMemo } from "react";

import type { AvailabilityOptions, AvailabilityOverview, SkillOptions } from "../../api/types";
import { DashboardBody, DashboardControlDeck, DashboardPage, MoreFilters } from "../../components/layout/pageZones";
import { MultiSelect } from "../../components/ui/MultiSelect";
import { OrgKpiStrip } from "../../components/ui/OrgKpiStrip";
import { SkillsFilter } from "../../components/ui/SkillsFilter";
import { Card, ErrorBlock, LoadingBlock, SectionHeader } from "../../components/ui/primitives";
import { useApi } from "../../hooks/useApi";
import { useUrlFilters } from "../../hooks/useUrlFilters";
import { listOptions, tenureOptions } from "../../lib/tags";
import { CONTRACT_CHART_COLOR, CONTRACT_ORDER, STATUS_ORDER, STATUS_STYLE } from "../../lib/status";
import { MonthlyStackedChart, type ChartMonth } from "./MonthlyStackedChart";

const FILTER_KEYS = ["months", "cc", "bv", "client", "tenure", "division", "cap", "grade", "loc", "skill", "skilllevel"];
const MORE_KEYS = ["division", "cap", "grade", "tenure", "skill", "skilllevel"];

export function AvailabilityPage() {
  const url = useUrlFilters();

  const months = url.getAll("months");
  const contract = url.getAll("cc");
  const divisions = url.getAll("division");
  const capabilities = url.getAll("cap");
  const grades = url.getAll("grade");
  const locations = url.getAll("loc");
  const skillNames = url.getAll("skill");
  const skillLevels = url.getAll("skilllevel");
  const verticals = url.getAll("bv");
  const clients = url.getAll("client");
  const tenures = url.getAll("tenure");

  const filterParams = useMemo(
    () => ({
      months,
      contract_category: contract,
      division: divisions,
      capability: capabilities,
      grade: grades,
      location: locations,
      skill: skillNames,
      skill_level: skillLevels,
      business_vertical: verticals,
      client: clients,
      tenure: tenures,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [url.params],
  );

  const options = useApi<AvailabilityOptions>("/availability/options");
  const skillOptions = useApi<SkillOptions>("/skills/options");
  const overview = useApi<AvailabilityOverview>("/availability/overview", filterParams);

  const activeFilters = FILTER_KEYS.filter((key) => url.getAll(key).length > 0).length;
  const activeMore = MORE_KEYS.filter((key) => url.getAll(key).length > 0).length;
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
    <DashboardPage>
      {overview.error ? (
        <ErrorBlock message={overview.error} onRetry={overview.reload} />
      ) : (
        <DashboardControlDeck
          pageTitle="Availability"
          filterCount={activeFilters}
          onReset={resetAll}
          kpis={
            <OrgKpiStrip kpis={kpis} />
          }
        >
          <>
            <MultiSelect
              variant="pill"
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
              variant="pill"
              label="Business vertical"
              options={listOptions(options.data?.business_verticals)}
              selected={verticals}
              onChange={(values) => url.setValues({ bv: values })}
            />
            <MultiSelect
              variant="pill"
              label="Client"
              options={listOptions(options.data?.clients)}
              selected={clients}
              onChange={(values) => url.setValues({ client: values })}
            />
            <MultiSelect
              variant="pill"
              label="Location"
              options={listOptions(options.data?.locations)}
              selected={locations}
              onChange={(values) => url.setValues({ loc: values })}
            />
            <MultiSelect
              variant="pill"
              label="Contract category"
              options={CONTRACT_ORDER.map((c) => ({ value: c, label: c }))}
              selected={contract}
              onChange={(values) => url.setValues({ cc: values })}
            />
            <MoreFilters activeCount={activeMore}>
              <MultiSelect
                variant="pill"
                label="Tenure"
                options={tenureOptions(options.data?.tenures)}
                selected={tenures}
                onChange={(values) => url.setValues({ tenure: values })}
              />
              <MultiSelect
                variant="pill"
                label="Division"
                options={listOptions(options.data?.divisions)}
                selected={divisions}
                onChange={(values) => url.setValues({ division: values })}
              />
              <MultiSelect
                variant="pill"
                label="Primary capability"
                options={listOptions(options.data?.capabilities)}
                selected={capabilities}
                onChange={(values) => url.setValues({ cap: values })}
              />
              <MultiSelect
                variant="pill"
                label="Grade"
                options={listOptions(options.data?.grades)}
                selected={grades}
                onChange={(values) => url.setValues({ grade: values })}
              />
              <SkillsFilter
                options={skillOptions.data}
                names={skillNames}
                levels={skillLevels}
                onNamesChange={(values) => url.setValues({ skill: values })}
                onLevelsChange={(values) => url.setValues({ skilllevel: values })}
              />
            </MoreFilters>
          </>
        </DashboardControlDeck>
      )}

      <DashboardBody>
        <section aria-labelledby="availability-trends-heading">
          <SectionHeader
            compact
            id="availability-trends-heading"
            title="Trends"
            subtitle="Monthly distribution of the filtered population"
          />
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
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
      </DashboardBody>
    </DashboardPage>
  );
}