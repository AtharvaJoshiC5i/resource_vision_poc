import { useMemo, useState } from "react";

import type { AvailabilityMatrix, AvailabilityOptions, AvailabilityOverview, SkillOptions } from "../../api/types";
import { DashboardBody, DashboardControlDeck, FilterSearch, MoreFilters } from "../../components/layout/pageZones";
import { MultiSelect } from "../../components/ui/MultiSelect";
import { OrgKpiStrip } from "../../components/ui/OrgKpiStrip";
import { SkillsFilter } from "../../components/ui/SkillsFilter";
import { TableCard } from "../../components/ui/TableCard";
import { integer } from "../../lib/format";
import { listOptions, tenureOptions } from "../../lib/tags";
import { EmptyBlock, ErrorBlock, Pagination, TableSkeleton } from "../../components/ui/primitives";
import { useApi } from "../../hooks/useApi";
import { useUrlFilters } from "../../hooks/useUrlFilters";
import { AvailabilityMatrixView, MatrixLegend } from "../availability/AvailabilityMatrix";
import { EmployeeSquadBar } from "./EmployeeSquadBar";

const PAGE_SIZE = 50;

/* ----------------------------------------------------------------------------- page body */
export function EmployeeDirectory({
  pageTitle,
  pageSubtitle,
}: {
  pageTitle: string;
  pageSubtitle?: string;
}) {
  const url = useUrlFilters();
  const options = useApi<AvailabilityOptions>("/availability/options");
  const skillOptions = useApi<SkillOptions>("/skills/options");
  const months = url.getAll("months");
  const statuses = url.getAll("status");
  const capabilities = url.getAll("cap");
  const grades = url.getAll("grade");
  const locations = url.getAll("loc");
  const query = url.getOne("q");
  const skillNames = url.getAll("skill");
  const skillLevels = url.getAll("skilllevel");
  const verticals = url.getAll("bv");
  const clients = url.getAll("client");
  const tenures = url.getAll("tenure");
  const squad = url.getAll("squad");

  const filterKey = JSON.stringify([
    months, statuses, capabilities, grades, locations, query, skillNames, skillLevels, verticals, clients, tenures,
    squad,
  ]);
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 });
  const page = pageState.key === filterKey ? pageState.page : 1;

  // The summary follows months and the attribute filters (skills included); status and search
  // only narrow the matrix.
  const scopeParams = useMemo(
    () => ({
      months,
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
  const matrixParams = useMemo(
    () => ({
      ...scopeParams,
      status: statuses,
      search: query.trim() || undefined,
      squad: squad.length > 0 ? squad : undefined,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [url.params],
  );
  const overview = useApi<AvailabilityOverview>("/availability/overview", scopeParams);
  const matrix = useApi<AvailabilityMatrix>("/availability/matrix", { ...matrixParams, page, page_size: PAGE_SIZE });
  const filtering = Boolean(
    months.length ||
      statuses.length ||
      capabilities.length ||
      grades.length ||
      locations.length ||
      query ||
      skillNames.length ||
      skillLevels.length ||
      verticals.length ||
      clients.length ||
      tenures.length ||
      squad.length,
  );

  const activeFilters =
    (months.length > 0 ? 1 : 0) +
    (statuses.length > 0 ? 1 : 0) +
    (capabilities.length > 0 ? 1 : 0) +
    (grades.length > 0 ? 1 : 0) +
    (locations.length > 0 ? 1 : 0) +
    (query ? 1 : 0) +
    (skillNames.length > 0 || skillLevels.length > 0 ? 1 : 0) +
    (verticals.length > 0 ? 1 : 0) +
    (clients.length > 0 ? 1 : 0) +
    (tenures.length > 0 ? 1 : 0) +
    (squad.length > 0 ? 1 : 0);
  const activeMore =
    (capabilities.length > 0 ? 1 : 0) +
    (grades.length > 0 ? 1 : 0) +
    (tenures.length > 0 ? 1 : 0) +
    (skillNames.length > 0 || skillLevels.length > 0 ? 1 : 0);

  const resetFilters = () =>
    url.setValues({
      months: [], q: null, status: [], cap: [], grade: [], loc: [], skill: [], skilllevel: [], skillmatch: null,
      bv: [], client: [], tenure: [], squad: [],
    });

  const kpis = overview.data?.kpis;
  const monthOptions = options.data?.months ?? [];

  return (
    <>
      {overview.error ? (
        <ErrorBlock message={overview.error} onRetry={overview.reload} />
      ) : (
        <DashboardControlDeck
          pageTitle={pageTitle}
          pageSubtitle={pageSubtitle}
          filterCount={activeFilters}
          filterNote={
            squad.length > 0
              ? `Squad active: matrix lists ${squad.length} ${squad.length === 1 ? "person" : "people"}; other filters still apply`
              : activeFilters > 0
                ? `${activeFilters} filters narrow the matrix below`
                : undefined
          }
          onReset={resetFilters}
          kpis={
            <OrgKpiStrip kpis={kpis} />
          }
        >
          <>
            <MultiSelect
              variant="pill"
              label="Reporting month"
              options={monthOptions.map((m) => ({
                value: String(m.key),
                label: m.label,
                hint: m.has_data ? undefined : "No data",
              }))}
              selected={months}
              onChange={(values) => url.setValues({ months: values })}
            />
            <FilterSearch
              id="employee-matrix-search"
              label="Search employees"
              placeholder="Search name or code"
              value={query}
              onChange={(value) => url.setValues({ q: value || null })}
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
                label="Capability"
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
        <EmployeeSquadBar squad={squad} onSquadChange={(keys) => url.setValues({ squad: keys })} />
        <TableCard
          title="Allocation by employee and month"
          titleId="employees-matrix-heading"
          count={
            matrix.data
              ? squad.length > 0
                ? `${integer(matrix.data.total)} of ${integer(squad.length)} in squad`
                : `${integer(matrix.data.total)} ${matrix.data.total === 1 ? "employee" : "employees"}`
              : undefined
          }
          description={
            squad.length > 0
              ? "Showing your squad only. Status cells match the months and filters above."
              : "One row per employee. Hover or focus a cell for the status and remaining hours. Select a name to open the profile."
          }
          toolbar={
            <MatrixLegend
              selected={statuses}
              onToggle={(value) =>
                url.setValues({ status: statuses.includes(value) ? statuses.filter((s) => s !== value) : [...statuses, value] })
              }
              onClear={() => url.setValues({ status: [] })}
            />
          }
          footer={
            matrix.data && matrix.data.pages > 1 ? (
              <Pagination
                page={matrix.data.page}
                pages={matrix.data.pages}
                total={matrix.data.total}
                pageSize={matrix.data.page_size}
                onChange={(next) => setPageState({ key: filterKey, page: next })}
              />
            ) : undefined
          }
        >
          {matrix.error ? (
            <div className="p-4 sm:p-5">
              <ErrorBlock message={matrix.error} onRetry={matrix.reload} />
            </div>
          ) : !matrix.data ? (
            <div className="p-4 sm:p-5">
              <TableSkeleton rows={8} columns={10} label="Loading employee matrix" />
            </div>
          ) : matrix.data.rows.length === 0 ? (
            <div className="p-4 sm:p-5">
              <EmptyBlock
                message={
                  squad.length > 0
                    ? "No one in your squad matches the current filters"
                    : filtering
                      ? "No employees match these filters"
                      : "No employees found for these months"
                }
              />
            </div>
          ) : (
            <AvailabilityMatrixView matrix={matrix.data} />
          )}
        </TableCard>
      </DashboardBody>
    </>
  );
}
