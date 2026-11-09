import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  ChevronRight,
  ChevronsUpDown,
  FolderKanban,
  Search,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";

import type { ProjectOptions, ProjectRow, ProjectsOverview } from "../../api/types";
import { MultiSelect, SelectField } from "../../components/ui/MultiSelect";
import { FilterCard, PageZones, SummarySection } from "../../components/layout/pageZones";
import {
  Card,
  EmptyBlock,
  ErrorBlock,
  KpiCard,
  LoadingBlock,
  PageHeader,
  Pill,
  fieldClass,
  labelClass,
  tableHeadClass,
} from "../../components/ui/primitives";
import { useApi } from "../../hooks/useApi";
import { useUrlFilters } from "../../hooks/useUrlFilters";
import { hours, integer, shortDate } from "../../lib/format";
import { CONTRACT_ORDER, projectStatusTone } from "../../lib/status";

const FILTER_KEYS = ["months", "cc", "coverage", "q"] as const;
const COVERAGE_DEFAULT = "All Projects";

type SortKey = keyof Pick<
  ProjectRow,
  "name" | "id" | "client_bu" | "contract_category" | "status" | "start" | "end" | "employees" | "planned_hours"
>;

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "name", label: "Project" },
  { key: "id", label: "Project ID" },
  { key: "client_bu", label: "Client or business unit" },
  { key: "contract_category", label: "Contract category" },
  { key: "status", label: "Status" },
  { key: "start", label: "Start" },
  { key: "end", label: "End" },
  { key: "employees", label: "Employees", numeric: true },
  { key: "planned_hours", label: "Planned h", numeric: true },
];

function compare(a: ProjectRow, b: ProjectRow, key: SortKey): number {
  const left = a[key];
  const right = b[key];
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left).localeCompare(String(right), undefined, { sensitivity: "base" });
}

function shareOf(part: number | undefined, total: number | undefined) {
  if (part === undefined || !total) return undefined;
  return `${Math.round((part / total) * 100)}%`;
}

function PortfolioTable({ rows, onOpen }: { rows: ProjectRow[]; onOpen: (id: string) => void }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  const sorted = useMemo(() => {
    const list = [...rows].sort((a, b) => compare(a, b, sort.key));
    return sort.dir === "asc" ? list : list.reverse();
  }, [rows, sort]);

  return (
    <div className="overflow-auto rounded-lg border border-hairline" tabIndex={0} role="region" aria-label="Project portfolio">
      <table className="w-full min-w-[920px] border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-surface">
          <tr>
            {COLUMNS.map((col) => {
              const active = sort.key === col.key;
              const Icon = !active ? ChevronsUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                  className={`${tableHeadClass} ${col.numeric ? "text-right" : "text-left"}`}
                >
                  <button
                    type="button"
                    className={`-mx-1 inline-flex items-center gap-1 rounded px-1 hover:text-ink ${active ? "text-ink" : ""}`}
                    onClick={() =>
                      setSort((prev) => ({ key: col.key, dir: prev.key === col.key && prev.dir === "asc" ? "desc" : "asc" }))
                    }
                  >
                    {col.label}
                    <Icon aria-hidden="true" className={`h-3.5 w-3.5 ${active ? "text-primary" : ""}`} />
                  </button>
                </th>
              );
            })}
            <th scope="col" className={`${tableHeadClass} w-10 text-right`}>
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {sorted.map((row) => {
            const tone = projectStatusTone(row.status);
            return (
              <tr
                key={row.id}
                tabIndex={0}
                onClick={() => onOpen(row.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpen(row.id);
                  }
                }}
                className="group cursor-pointer text-ink-soft hover:bg-canvas"
              >
                <td className="px-3 py-2.5">
                  <span className="font-medium text-ink group-hover:text-purple-indigo">{row.name}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-muted">{row.id}</td>
                <td className="px-3 py-2.5">{row.client_bu}</td>
                <td className="whitespace-nowrap px-3 py-2.5">{row.contract_category}</td>
                <td className="px-3 py-2.5">
                  <Pill bg={tone.bg} fg={tone.fg}>
                    {row.status}
                  </Pill>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{shortDate(row.start)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{shortDate(row.end)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{row.employees}</td>
                <td className="px-3 py-2.5 text-right font-medium tabular-nums text-ink">{hours(row.planned_hours)}</td>
                <td className="px-2 py-2.5 text-right">
                  <ChevronRight aria-hidden="true" className="ml-auto h-4 w-4 text-muted group-hover:text-primary" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ProjectsDirectory({ onOpen }: { onOpen: (id: string) => void }) {
  const url = useUrlFilters();
  const months = url.getAll("months");
  const contract = url.getAll("cc");
  const coverage = url.getOne("coverage") || COVERAGE_DEFAULT;
  const search = url.getOne("q");
  const [searchText, setSearchText] = useState(search);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (searchText !== search) url.setValues({ q: searchText.trim() || null });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchText, search, url]);

  const options = useApi<ProjectOptions>("/projects/options");
  const params = { months, contract_category: contract, search };
  const overview = useApi<ProjectsOverview>("/projects", { ...params, coverage });

  const activeFilters =
    (months.length > 0 ? 1 : 0) +
    (contract.length > 0 ? 1 : 0) +
    (coverage !== COVERAGE_DEFAULT ? 1 : 0) +
    (search ? 1 : 0);
  const resetFilters = () => url.reset(["project"]);

  const rows = overview.data?.rows ?? [];
  const kpis = overview.data?.kpis;

  return (
    <PageZones>
      <PageHeader
        title="Projects"
        subtitle={
          overview.data
            ? `${integer(rows.length)} projects in view. Open one for team allocation and monthly planned hours.`
            : "Planned effort by project from Project Track"
        }
      />

      <FilterCard
        filterCount={activeFilters}
        filterTotal={FILTER_KEYS.length}
        onReset={resetFilters}
        resetDisabled={activeFilters === 0}
      >
        <div role="group" aria-label="Filters" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
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
          <SelectField
            label="Project coverage"
            value={coverage}
            options={(options.data?.coverage ?? ["All Projects"]).map((c) => ({ value: c, label: c }))}
            onChange={(value) => url.setValues({ coverage: value === COVERAGE_DEFAULT ? null : value })}
          />
          <div className="min-w-0">
            <label htmlFor="project-search" className={labelClass}>
              Search
            </label>
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                id="project-search"
                type="search"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                className={`${fieldClass} pl-9`}
                placeholder="Project name, ID or client"
              />
            </div>
          </div>
        </div>
      </FilterCard>

      {overview.error ? (
        <ErrorBlock message={overview.error} onRetry={overview.reload} />
      ) : (
        <SummarySection id="projects-summary-heading" subtitle="Projects matching the current filters">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Total projects"
              icon={FolderKanban}
              value={kpis?.total_projects}
              caption="Matching the current filters"
              loading={!kpis}
            />
            <KpiCard
              label="Active projects"
              icon={Activity}
              tone="success"
              value={kpis?.active_projects}
              emphasis={shareOf(kpis?.active_projects, kpis?.total_projects)}
              caption={kpis?.total_projects ? "of all projects" : "No projects in view"}
              loading={!kpis}
            />
            <KpiCard
              label="Projects with employees"
              icon={UserRoundCheck}
              tone="lavender"
              value={kpis?.projects_with_employees}
              emphasis={shareOf(kpis?.projects_with_employees, kpis?.total_projects)}
              caption={kpis?.total_projects ? "of all projects" : "No projects in view"}
              loading={!kpis}
            />
            <KpiCard
              label="Employees assigned"
              icon={UsersRound}
              value={kpis?.employees_assigned}
              caption="Across the projects in view"
              loading={!kpis}
            />
          </div>
        </SummarySection>
      )}

      <Card
        title="Portfolio"
        titleId="projects-portfolio-heading"
        subtitle="Sort columns to compare projects. Active means started on or before today and ends on or after today."
        actions={
          overview.data ? (
            <span className="text-[12px] tabular-nums text-muted">
              <span className="font-medium text-ink-soft">{integer(rows.length)}</span> {rows.length === 1 ? "project" : "projects"}
            </span>
          ) : undefined
        }
      >
        {!overview.data && !overview.error ? (
          <LoadingBlock height={220} label="Loading projects" />
        ) : rows.length === 0 ? (
          <EmptyBlock message="No projects match the current filters" />
        ) : (
          <PortfolioTable rows={rows} onOpen={onOpen} />
        )}
      </Card>
    </PageZones>
  );
}
