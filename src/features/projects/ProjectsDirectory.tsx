import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  ChevronRight,
  ChevronsUpDown,
  FolderKanban,
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
  MetaField,
  PageHeader,
  Pill,
  TableSkeleton,
  buttonClass,
  fieldClass,
  labelClass,
  TableFrame,
  rowChevronClass,
} from "../../components/ui/primitives";
import {
  tableClassInteractive,
  tableHeadClass,
  tableStickyColClass,
} from "../../components/ui/tableClasses";
import {
  TableNumeric,
  TableText,
  tableBodyId,
  tableRowActionClass,
} from "../../components/ui/tableCells";
import { sortIconClass } from "../../components/ui/tableStyles";
import { useApi } from "../../hooks/useApi";
import { useUrlFilters } from "../../hooks/useUrlFilters";
import { hours, integer, shortDate } from "../../lib/format";
import { CONTRACT_ORDER, projectStatusTone } from "../../lib/status";
import { ProjectSearchCombobox } from "./projectPicker";

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

function PortfolioTable({ rows, onOpen }: { rows: ProjectRow[]; onOpen: (id: string) => void }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  const sorted = useMemo(() => {
    const list = [...rows].sort((a, b) => compare(a, b, sort.key));
    return sort.dir === "asc" ? list : list.reverse();
  }, [rows, sort]);

  return (
    <>
    <div className="mb-3 flex items-end gap-2 md:hidden">
      <div className="min-w-0 flex-1">
        <label htmlFor="project-portfolio-sort" className={labelClass}>
          Sort by
        </label>
        <select
          id="project-portfolio-sort"
          value={sort.key}
          onChange={(event) => setSort((prev) => ({ ...prev, key: event.target.value as SortKey }))}
          className={fieldClass}
        >
          {COLUMNS.map((col) => (
            <option key={col.key} value={col.key}>
              {col.label}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={() => setSort((prev) => ({ ...prev, dir: prev.dir === "asc" ? "desc" : "asc" }))}
        aria-label={sort.dir === "asc" ? "Sorted ascending, switch to descending" : "Sorted descending, switch to ascending"}
        className={`${buttonClass} h-9 w-9 shrink-0 px-0 touch:h-11 touch:w-11`}
      >
        {sort.dir === "asc" ? <ArrowUp aria-hidden="true" className="h-4 w-4" /> : <ArrowDown aria-hidden="true" className="h-4 w-4" />}
      </button>
    </div>

    <ul aria-label="Project portfolio" className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline md:hidden">
      {sorted.map((row) => {
        const tone = projectStatusTone(row.status);
        return (
          <li key={row.id} className="relative transition-colors hover:bg-canvas">
            <div className="flex flex-col gap-3 px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => onOpen(row.id)}
                    className="block max-w-full break-words text-left font-medium text-ink after:absolute after:inset-0 after:content-['']"
                  >
                    {row.name}
                  </button>
                  <p className="text-xs tabular-nums text-muted">{row.id}</p>
                </div>
                <Pill bg={tone.bg} fg={tone.fg}>
                  {row.status}
                </Pill>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                <MetaField label="Client or business unit" value={row.client_bu} className="col-span-2" />
                <MetaField label="Contract category" value={row.contract_category} className="col-span-2" />
                <MetaField label="Start" value={shortDate(row.start)} />
                <MetaField label="End" value={shortDate(row.end)} />
                <MetaField label="Employees" value={row.employees} />
                <MetaField label="Planned h" value={hours(row.planned_hours)} />
              </dl>
            </div>
          </li>
        );
      })}
    </ul>

    <TableFrame nested className="hidden md:block" tabIndex={0} role="region" aria-label="Project portfolio">
      <table className={`${tableClassInteractive} min-w-[920px]`}>
        <thead>
          <tr>
            {COLUMNS.map((col, colIndex) => {
              const active = sort.key === col.key;
              const Icon = !active ? ChevronsUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                  className={`${tableHeadClass} ${col.numeric ? "text-right" : "text-left"} ${colIndex === 0 ? tableStickyColClass : ""}`}
                >
                  <button
                    type="button"
                    className="group/sort -mx-1 inline-flex items-center gap-1 rounded px-1 touch:py-2.5"
                    onClick={() =>
                      setSort((prev) => ({ key: col.key, dir: prev.key === col.key && prev.dir === "asc" ? "desc" : "asc" }))
                    }
                  >
                    {col.label}
                    <Icon aria-hidden="true" className={sortIconClass(active)} />
                  </button>
                </th>
              );
            })}
            <th scope="col" className={`${tableHeadClass} w-10 text-right`}>
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
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
                className="group text-ink-soft"
              >
                <td className={`${tableStickyColClass}`}>
                  <span className="block truncate text-[13px] font-medium leading-5 text-ink transition-colors group-hover:text-primary">
                    {row.name}
                  </span>
                </td>
                <td className="whitespace-nowrap">
                  <span className={tableBodyId}>{row.id}</span>
                </td>
                <td>
                  <TableText title={row.client_bu}>{row.client_bu}</TableText>
                </td>
                <td className="whitespace-nowrap">
                  <TableText>{row.contract_category}</TableText>
                </td>
                <td>
                  <Pill bg={tone.bg} fg={tone.fg}>
                    {row.status}
                  </Pill>
                </td>
                <td className="whitespace-nowrap">
                  <TableNumeric>{shortDate(row.start)}</TableNumeric>
                </td>
                <td className="whitespace-nowrap">
                  <TableNumeric>{shortDate(row.end)}</TableNumeric>
                </td>
                <td className="text-right">
                  <TableNumeric strong className="inline-block w-full text-right">
                    {row.employees}
                  </TableNumeric>
                </td>
                <td className="text-right">
                  <TableNumeric strong className="inline-block w-full text-right">
                    {hours(row.planned_hours)}
                  </TableNumeric>
                </td>
                <td className="w-12 text-right">
                  <span className={`ml-auto ${tableRowActionClass}`}>
                    <ChevronRight aria-hidden="true" className={rowChevronClass} />
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableFrame>
    </>
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
        <div className="@container">
        <div role="group" aria-label="Filters" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:items-end">
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
        </div>
        </div>
      </FilterCard>

      <ProjectSearchCombobox
        options={options.data?.projects ?? []}
        search={searchText}
        onSearchChange={setSearchText}
        onSelect={onOpen}
      />

      {overview.error ? (
        <ErrorBlock message={overview.error} onRetry={overview.reload} />
      ) : (
        <SummarySection
          id="projects-summary-heading"
          subtitle="Totals across the full reporting window. Other filters narrow the project table; reporting month affects row hours only."
        >
          <div className="@container">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Total projects"
              icon={FolderKanban}
              value={kpis?.total_projects}
              caption="Full reporting window"
              loading={!kpis}
            />
            <KpiCard
              label="Active projects"
              icon={Activity}
              tone="success"
              value={kpis?.active_projects}
              loading={!kpis}
            />
            <KpiCard
              label="Projects with employees"
              icon={UserRoundCheck}
              tone="lavender"
              value={kpis?.projects_with_employees}
              loading={!kpis}
            />
            <KpiCard
              label="Employees assigned"
              icon={UsersRound}
              value={kpis?.employees_assigned}
              caption="Full reporting window"
              loading={!kpis}
            />
          </div>
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
          <TableSkeleton rows={6} columns={9} label="Loading projects" />
        ) : rows.length === 0 ? (
          <EmptyBlock message="No projects match the current filters" />
        ) : (
          <PortfolioTable rows={rows} onOpen={onOpen} />
        )}
      </Card>
    </PageZones>
  );
}
