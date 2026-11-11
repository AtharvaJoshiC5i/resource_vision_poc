import { useMemo, useState } from "react";
import { Search, UsersRound } from "lucide-react";

import type { AvailabilityMatrix, AvailabilityOptions, AvailabilityOverview, AvailabilityStatus } from "../../api/types";
import { FilterCard, SummarySection } from "../../components/layout/pageZones";
import { MultiSelect } from "../../components/ui/MultiSelect";
import {
  Card,
  EmptyBlock,
  ErrorBlock,
  KpiCard,
  Pagination,
  TableSkeleton,
  fieldClass,
  labelClass,
} from "../../components/ui/primitives";
import { useApi } from "../../hooks/useApi";
import { useUrlFilters } from "../../hooks/useUrlFilters";
import { STATUS_ICON } from "../../lib/status";
import { AvailabilityMatrixView, MatrixLegend } from "../availability/AvailabilityMatrix";

const PAGE_SIZE = 50;
const FILTER_TOTAL = 6;

const STATUS_CARDS: { status: AvailabilityStatus; label: string; key: keyof AvailabilityOverview["kpis"] }[] = [
  { status: "Fully Available", label: "Fully available", key: "fully_available" },
  { status: "Partially Available", label: "Partially available", key: "partially_available" },
  { status: "Fully Committed", label: "Fully committed", key: "fully_committed" },
  { status: "Over-allocated", label: "Over-allocated", key: "over_allocated" },
  { status: "Unverified", label: "Unverified", key: "unverified" },
];

/* ----------------------------------------------------------------------------- page body */
export function EmployeeDirectory() {
  const url = useUrlFilters();
  const options = useApi<AvailabilityOptions>("/availability/options");
  const months = url.getAll("months");
  const statuses = url.getAll("status");
  const capabilities = url.getAll("cap");
  const grades = url.getAll("grade");
  const locations = url.getAll("loc");
  const query = url.getOne("q");

  const filterKey = JSON.stringify([months, statuses, capabilities, grades, locations, query]);
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 });
  const page = pageState.key === filterKey ? pageState.page : 1;

  // The summary follows months and the attribute filters; status and search only narrow the matrix.
  const scopeParams = useMemo(
    () => ({ months, capability: capabilities, grade: grades, location: locations }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [url.params],
  );
  const matrixParams = useMemo(
    () => ({ ...scopeParams, status: statuses, search: query.trim() || undefined }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [url.params],
  );
  const overview = useApi<AvailabilityOverview>("/availability/overview", scopeParams);
  const matrix = useApi<AvailabilityMatrix>("/availability/matrix", { ...matrixParams, page, page_size: PAGE_SIZE });
  const filtering = Boolean(
    months.length || statuses.length || capabilities.length || grades.length || locations.length || query,
  );

  const activeFilters =
    (months.length > 0 ? 1 : 0) +
    (statuses.length > 0 ? 1 : 0) +
    (capabilities.length > 0 ? 1 : 0) +
    (grades.length > 0 ? 1 : 0) +
    (locations.length > 0 ? 1 : 0) +
    (query ? 1 : 0);

  const resetFilters = () => url.setValues({ months: [], q: null, status: [], cap: [], grade: [], loc: [] });

  const kpis = overview.data?.kpis;
  const monthOptions = options.data?.months ?? [];

  return (
    <>
      <SummarySection
        id="directory-status-heading"
        title="Team across the reporting window"
        subtitle="Distinct employees in the full reporting window. An employee who changes status between months is counted under each status they had. Month and status filters affect the matrix only."
      >
        {overview.error ? (
          <ErrorBlock message={overview.error} onRetry={overview.reload} />
        ) : (
          <div className="@container">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-6">
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
        filterTotal={FILTER_TOTAL}
        onReset={resetFilters}
        resetDisabled={!filtering}
        subtitle={
          activeFilters > 0
            ? undefined
            : "KPIs use the full reporting window. Month selection and status chips scope the matrix only."
        }
      >
        <div className="@container">
          <div role="group" aria-label="Filters" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <MultiSelect
              label="Reporting month"
              options={monthOptions.map((m) => ({
                value: String(m.key),
                label: m.label,
                hint: m.has_data ? undefined : "No data",
              }))}
              selected={months}
              onChange={(values) => url.setValues({ months: values })}
            />
            <div className="min-w-0">
              <label htmlFor="employee-matrix-search" className={labelClass}>
                Search
              </label>
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                />
                <input
                  id="employee-matrix-search"
                  type="search"
                  value={query}
                  onChange={(event) => url.setValues({ q: event.target.value || null })}
                  placeholder="Name or code"
                  className={`${fieldClass} pl-9`}
                />
              </div>
            </div>
            <MultiSelect
              label="Capability"
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

      <Card
        title="Allocation by employee and month"
        titleId="employees-matrix-heading"
        subtitle="One row per employee. Hover or focus a cell for the status and remaining hours. Select a name to open the profile."
      >
        <div className="mb-4">
          <MatrixLegend
            selected={statuses}
            onToggle={(value) =>
              url.setValues({ status: statuses.includes(value) ? statuses.filter((s) => s !== value) : [...statuses, value] })
            }
            onClear={() => url.setValues({ status: [] })}
          />
        </div>
        {matrix.error ? (
          <ErrorBlock message={matrix.error} onRetry={matrix.reload} />
        ) : !matrix.data ? (
          <TableSkeleton rows={8} columns={10} label="Loading employee matrix" />
        ) : matrix.data.rows.length === 0 ? (
          <EmptyBlock message={filtering ? "No employees match these filters" : "No employees found for these months"} />
        ) : (
          <>
            <AvailabilityMatrixView matrix={matrix.data} />
            <Pagination
              page={matrix.data.page}
              pages={matrix.data.pages}
              total={matrix.data.total}
              pageSize={matrix.data.page_size}
              onChange={(next) => setPageState({ key: filterKey, page: next })}
            />
          </>
        )}
      </Card>
    </>
  );
}
