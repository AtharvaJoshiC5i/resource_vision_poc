import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronRight, ChevronsUpDown } from "lucide-react";

import type { ProjectOptions, ProjectRow, ProjectsOverview } from "../../api/types";
import { MultiSelect } from "../../components/ui/MultiSelect";
import { DashboardBody, DashboardControlDeck, DashboardPage } from "../../components/layout/pageZones";
import { EmptyBlock, ErrorBlock, MetaField, Pill, SegmentedControl, TableSkeleton, buttonClass, fieldClass, labelClass, rowChevronClass } from "../../components/ui/primitives";
import { tableClassInteractive, tableHeadClass, tableStickyColClass } from "../../components/ui/tableClasses";
import { TableNumeric, TableText, tableBodyId, tableRowActionClass } from "../../components/ui/tableCells";
import { sortIconClass, tableSortButtonClass } from "../../components/ui/tableStyles";
import { KpiBand, KpiGroup, KpiStat } from "../../components/ui/KpiBand";
import { TableCard, TableScroll } from "../../components/ui/TableCard";
import { useApi } from "../../hooks/useApi";
import { useUrlFilters } from "../../hooks/useUrlFilters";
import { hours, integer, shortDate } from "../../lib/format";
import { CONTRACT_ORDER, projectStatusTone } from "../../lib/status";
import { AccountUtilizationCard } from "./AccountUtilization";
import { ProjectSearchCombobox } from "./projectPicker";

const COVERAGE_DEFAULT = "All Projects";

type BodyView = "projects" | "accounts";

/** One table at a time below the control deck: projects or accounts, switched from either card header. */
function BodyViewSwitch({ value, onChange }: { value: BodyView; onChange: (next: BodyView) => void }) {
  return (
    <SegmentedControl
      label="Show"
      value={value}
      onChange={onChange}
      options={[
        { value: "projects", label: "Projects" },
        { value: "accounts", label: "By account" },
      ]}
    />
  );
}

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
  { key: "planned_hours", label: "Planned hours", numeric: true },
];

/** The desktop table folds the ID under the project name, so it has no column of its own. */
const TABLE_COLUMNS = COLUMNS.filter((col) => col.key !== "id");

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
    <div className="flex items-end gap-2 border-b border-hairline px-4 py-3 md:hidden">
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

    <ul aria-label="Project portfolio" className="divide-y divide-hairline md:hidden">
      {sorted.map((row) => {
        const tone = projectStatusTone(row.status);
        return (
          <li key={row.id} className="relative transition-colors hover:bg-canvas">
            <div className="flex flex-col gap-3 px-4 py-3.5">
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
                <MetaField label="Planned hours" value={hours(row.planned_hours)} />
              </dl>
            </div>
          </li>
        );
      })}
    </ul>

    <TableScroll className="hidden md:block" label="Project portfolio">
      <table className={`${tableClassInteractive} min-w-[57.5rem]`}>
        <thead>
          <tr>
            {TABLE_COLUMNS.map((col, colIndex) => {
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
                    className={tableSortButtonClass(col.numeric ? "right" : "left")}
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
                <td className={`${tableStickyColClass} max-w-[18rem]`}>
                  <TableText className="text-sm font-medium leading-5 text-ink transition-colors group-hover:text-primary">
                    {row.name}
                  </TableText>
                  <span className={`mt-0.5 block ${tableBodyId}`}>{row.id}</span>
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
                  <TableNumeric strong>{row.employees}</TableNumeric>
                </td>
                <td className="text-right">
                  <TableNumeric strong>{hours(row.planned_hours)}</TableNumeric>
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
    </TableScroll>
    </>
  );
}

export function ProjectsDirectory({ onOpen }: { onOpen: (id: string) => void }) {
  const url = useUrlFilters();
  const months = url.getAll("months");
  const contract = url.getAll("cc");
  const coverage = url.getOne("coverage") || COVERAGE_DEFAULT;
  const search = url.getOne("q");
  const bodyView: BodyView = url.getOne("view") === "accounts" ? "accounts" : "projects";
  const setBodyView = (next: BodyView) => url.setValues({ view: next === "projects" ? null : next });
  const viewSwitch = <BodyViewSwitch value={bodyView} onChange={setBodyView} />;
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
  const resetFilters = () => url.reset(["project", "view"]);

  const rows = useMemo(() => overview.data?.rows ?? [], [overview.data]);
  const kpis = overview.data?.kpis;

  const searchProjectOptions = useMemo(() => {
    const all = options.data?.projects ?? [];
    if (!overview.data) return all;
    const visible = new Set(rows.map((row) => row.id));
    return all.filter((project) => visible.has(project.id));
  }, [options.data?.projects, overview.data, rows]);

  return (
    <DashboardPage>
      {overview.error ? (
        <ErrorBlock message={overview.error} onRetry={overview.reload} />
      ) : (
        <DashboardControlDeck
          pageTitle="Projects"
          metricsTitle="Portfolio totals"
          filterCount={activeFilters}
          onReset={resetFilters}
          kpis={
            <KpiBand label="Portfolio totals">
              <KpiGroup title="Portfolio" columns={4} aside={<span>Full reporting window</span>}>
                <KpiStat label="Total projects" value={kpis?.total_projects} caption="After coverage and filters" loading={!kpis} />
                <KpiStat label="Active projects" value={kpis?.active_projects} caption="Running as of today" loading={!kpis} />
                <KpiStat label="Projects with employees" value={kpis?.projects_with_employees} caption="At least one allocation" loading={!kpis} />
                <KpiStat label="Employees assigned" value={kpis?.employees_assigned} caption="Distinct people" loading={!kpis} />
              </KpiGroup>
            </KpiBand>
          }
        >
          <>
            <ProjectSearchCombobox
              options={searchProjectOptions}
              search={searchText}
              onSearchChange={setSearchText}
              onSelect={onOpen}
            />
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
              label="Contract category"
              options={CONTRACT_ORDER.map((c) => ({ value: c, label: c }))}
              selected={contract}
              onChange={(values) => url.setValues({ cc: values })}
            />
            <MultiSelect
              variant="pill"
              selectionMode="single"
              baselineValue={COVERAGE_DEFAULT}
              label="Coverage"
              options={(options.data?.coverage ?? ["All Projects"]).map((c) => ({ value: c, label: c }))}
              selected={coverage !== COVERAGE_DEFAULT ? [coverage] : []}
              onChange={(values) => {
                const next = values[0];
                if (!next || next === COVERAGE_DEFAULT) url.setValues({ coverage: null });
                else url.setValues({ coverage: next });
              }}
            />
          </>
        </DashboardControlDeck>
      )}


      <DashboardBody>
        {bodyView === "accounts" ? (
          <AccountUtilizationCard months={months} actions={viewSwitch} />
        ) : (
        <TableCard
          title="Portfolio"
          actions={viewSwitch}
          titleId="projects-portfolio-heading"
          count={overview.data ? `${integer(rows.length)} ${rows.length === 1 ? "project" : "projects"}` : undefined}
        >
          {!overview.data && !overview.error ? (
            <div className="p-4 sm:p-5">
              <TableSkeleton rows={6} columns={9} label="Loading projects" />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-4 sm:p-5">
              <EmptyBlock message="No projects match the current filters" />
            </div>
          ) : (
            <PortfolioTable rows={rows} onOpen={onOpen} />
          )}
        </TableCard>
        )}
      </DashboardBody>
    </DashboardPage>
  );
}
