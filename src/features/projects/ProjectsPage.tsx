import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  ChevronDown,
  ClipboardList,
  FolderKanban,
  Search,
  TrendingUp,
  UsersRound,
} from "lucide-react";

import type { ProjectDetail, ProjectOptions, ProjectsOverview } from "../../api/types";
import { MultiSelect } from "../../components/ui/MultiSelect";
import { PageZones } from "../../components/layout/pageZones";
import {
  Card,
  EmptyBlock,
  ErrorBlock,
  FlagBadge,
  KpiCard,
  LoadingBlock,
  Pill,
  SectionHeader,
  fieldClass,
  TableEmpty,
  TableHourCell,
  TableNumeric,
  tableBodyId,
  tableBodyMeta,
  tableClassMatrix,
  tableStickyColClass,
  tableTotalColClass,
} from "../../components/ui/primitives";
import { useScrollEdges } from "../../hooks/useScrollEdges";
import { useApi } from "../../hooks/useApi";
import { useUrlFilters } from "../../hooks/useUrlFilters";
import { CHART_AXIS, CHART_AXIS_TITLE, CHART_CURSOR, CHART_FONT, CHART_GRID, CHART_TOOLTIP } from "../../lib/chart";
import { EM_DASH, compactMonth, hours, integer, shortDate, text } from "../../lib/format";
import { projectStatusTone } from "../../lib/status";
import { ProjectsDirectory } from "./ProjectsDirectory";

const COVERAGE_DEFAULT = "All Projects";

const profileControlLabel = "mb-1.5 block text-xs font-medium tracking-wide text-ink-soft";

/** Profile row: reporting months + project switcher share one control height. */
const profileFilterTrigger = "!h-14 !min-h-14 items-center py-0";

const projectSelectTrigger =
  "w-full rounded-lg border border-border bg-surface text-sm text-ink transition-colors hover:border-muted/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15";

/** Shared viewport height for team table and trend chart (fixed, not min-* stacking). */
const PROJECT_WORK_VIEWPORT = "h-[max(15rem,min(19.5rem,36dvh))] max-h-[max(15rem,min(19.5rem,36dvh))]";

/** Team table: grows with its content on phones, scrolls on tablets, matches the chart height when side by side. */
const PROJECT_TEAM_VIEWPORT =
  "max-h-[min(32rem,70dvh)] max-md:max-h-none xl:h-[max(15rem,min(19.5rem,36dvh))] xl:max-h-[max(15rem,min(19.5rem,36dvh))]";

/** Bordered scroll well with optional footnote — keeps wide tables/charts feeling intentional, not cramped. */
function PanelScrollFrame({
  hint,
  children,
  axis = "both",
  viewportClass = PROJECT_WORK_VIEWPORT,
  flush = false,
}: {
  hint?: string;
  children: ReactNode;
  axis?: "x" | "y" | "both";
  viewportClass?: string;
  /** No inset padding — avoids a left gutter beside sticky table columns. */
  flush?: boolean;
}) {
  const scrollRef = useScrollEdges();
  const overflow =
    axis === "x"
      ? "overflow-x-auto overflow-y-hidden"
      : axis === "y"
        ? "overflow-y-auto overflow-x-hidden"
        : "overflow-auto";
  const pad = flush ? "p-0" : "px-2 py-2";
  return (
    <div className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-hairline bg-surface`}>
      <div ref={scrollRef} className={`${overflow} ${viewportClass} ${pad} overscroll-contain [scrollbar-gutter:stable]`} tabIndex={0}>
        {children}
      </div>
      {hint ? <p className="border-t border-hairline px-3 py-2.5 text-xs leading-snug text-muted">{hint}</p> : null}
    </div>
  );
}

function ProjectFactRow({ label, value, numeric = false }: { label: string; value: ReactNode; numeric?: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-hairline px-4 py-3 last:border-b-0 sm:grid-cols-[10.5rem_minmax(0,1fr)] sm:items-baseline sm:gap-4 sm:px-5 sm:py-3.5">
      <dt className="text-xs font-medium leading-snug text-muted">{label}</dt>
      <dd className={`min-w-0 text-[13px] font-medium leading-snug text-ink ${numeric ? "tabular-nums" : ""}`}>{value}</dd>
    </div>
  );
}

function ProjectRecordSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="border-b border-hairline bg-canvas/35 px-4 py-2 sm:px-5">
        <h3 className="text-[11px] font-semibold tracking-wide text-muted uppercase">{title}</h3>
      </div>
      <dl>{children}</dl>
    </div>
  );
}

function ProjectProfileStats({
  plannedHours,
  employees,
  monthCount,
}: {
  plannedHours: number | null | undefined;
  employees: number;
  monthCount: number;
}) {
  const items = [
    {
      label: "Planned",
      value: hours(plannedHours),
      unit: plannedHours !== null && plannedHours !== undefined ? "h" : undefined,
      hint: "Selected months",
    },
    {
      label: "Team",
      value: integer(employees),
      unit: undefined,
      hint: employees === 1 ? "Employee" : "Employees",
    },
    {
      label: "Months",
      value: integer(monthCount),
      unit: undefined,
      hint: "In matrix",
    },
  ] as const;

  return (
    <div role="group" aria-label="Project summary statistics" className="grid w-full grid-cols-3 rounded-xl border border-hairline bg-surface">
      {items.map((item, index) => (
        <div
          key={item.label}
          className={`flex min-w-0 flex-col justify-center px-3 py-3 sm:px-3.5 sm:py-3.5 ${index > 0 ? "border-l border-hairline" : ""}`}
        >
          <span className="text-[11px] font-medium tracking-wide text-muted uppercase">{item.label}</span>
          <p className="mt-1 flex min-w-0 items-baseline gap-1">
            <span className="truncate text-base font-semibold tabular-nums tracking-tight text-ink">{item.value}</span>
            {item.unit ? <span className="shrink-0 text-[12px] font-medium text-muted">{item.unit}</span> : null}
          </p>
          <span className="mt-0.5 text-[11px] leading-snug text-muted">{item.hint}</span>
        </div>
      ))}
    </div>
  );
}

function reportingWindowLabel(months: ProjectDetail["months"]) {
  if (months.length === 0) return "No months selected";
  if (months.length === 1) return months[0]!.label;
  return `${months[0]!.label} – ${months[months.length - 1]!.label} (${months.length} months)`;
}

type ProjectListOption = { id: string; label: string };

/** Options API uses `id: name`; split so ID and title are not shown twice. */
function parseProjectOption(option: ProjectListOption): { id: string; name: string } {
  const id = option.id.trim();
  let name = option.label.trim();
  if (name.startsWith(`${id}:`)) name = name.slice(id.length + 1).trim();
  else if (name.startsWith(`${id} -`)) name = name.slice(id.length + 2).trim();
  else {
    const colon = name.indexOf(":");
    if (colon > 0 && name.slice(0, colon).trim() === id) name = name.slice(colon + 1).trim();
  }
  if (!name) name = option.label;
  return { id, name };
}

const projectIdentityGrid = "grid w-full min-w-0 items-center gap-x-3";
const projectIdentityCols = "[grid-template-columns:minmax(5.25rem,7.5rem)_1px_minmax(0,1fr)]";

function ProjectIdentityGrid({
  id,
  name,
  nameClass = "line-clamp-2 text-[14px] font-medium leading-snug text-ink",
  idClass = "text-[12px] font-semibold tabular-nums text-ink-soft",
}: {
  id: string;
  name: string;
  nameClass?: string;
  idClass?: string;
}) {
  return (
    <div className={`${projectIdentityGrid} ${projectIdentityCols}`}>
      <span className={`min-w-0 truncate ${idClass}`} title={id}>
        {id}
      </span>
      <span aria-hidden="true" className="h-8 w-px shrink-0 bg-hairline" />
      <span className={`min-w-0 ${nameClass}`} title={name}>
        {name}
      </span>
    </div>
  );
}

/** Bar top labels: stroke outline keeps figures readable when months are narrow. */
interface ValueLabelProps {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  /** From LabelList — planned hours for this month, or null when no bar label. */
  value?: number | null;
}

const formatBarHours = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 1 });

function ValueLabel({ x, y, width, value }: ValueLabelProps) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  return (
    <text
      x={Number(x) + Number(width) / 2}
      y={Number(y) - 6}
      textAnchor="middle"
      fontSize={11}
      fontWeight={500}
      fill="var(--color-ink-soft)"
      stroke="var(--color-surface)"
      strokeWidth={3}
      strokeLinejoin="round"
      paintOrder="stroke"
      style={{ fontFamily: CHART_FONT, fontVariantNumeric: "tabular-nums" }}
    >
      {formatBarHours(Number(value))}
    </text>
  );
}

/** Minimum category width scales with digit count so 18+ months stay legible. */
const slotWidth = (displayValues: (number | null)[]) => {
  const longest = Math.max(
    1,
    ...displayValues.map((v) => (v === null || v === undefined || !Number.isFinite(v) ? 0 : formatBarHours(v).length)),
  );
  return Math.max(44, Math.ceil(longest * 7 + 20));
};

function ProjectTrend({ detail }: { detail: ProjectDetail }) {
  /** Full reporting window: every month gets an axis tick; bars only when Project Track has data. */
  const data = detail.trend.map((t) => {
    const hrs = t.planned_hours;
    const hasNumeric = t.has_data && hrs !== null && hrs !== undefined;
    return {
      short: compactMonth(t.month),
      label: t.label,
      has_data: t.has_data,
      planned: t.has_data ? (hrs ?? 0) : 0,
      displayHours: hasNumeric ? hrs! : null,
    };
  });
  const slot = slotWidth(data.map((d) => d.displayHours));
  const chartMinWidth = Math.max(320, data.length * slot + 80);

  return (
    <figure aria-label="Monthly allocation trend" className="m-0 h-full min-h-0 w-max min-w-full">
      <div className="h-full min-h-0" style={{ width: Math.max(chartMinWidth, 280) }}>
        <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 22, right: 8, bottom: 4, left: 4 }} barCategoryGap="20%">
                <CartesianGrid vertical={false} {...CHART_GRID} />
                <XAxis
                  dataKey="short"
                  interval={0}
                  tick={CHART_AXIS}
                  tickLine={false}
                  axisLine={{ stroke: "var(--color-border)" }}
                  angle={-40}
                  textAnchor="end"
                  height={52}
                  label={{ value: "Reporting month", position: "insideBottom", offset: -2, style: { ...CHART_AXIS_TITLE, fontSize: 10 } }}
                />
                <YAxis
                  tick={CHART_AXIS}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                  allowDecimals={false}
                  label={{
                    value: "Planned hours",
                    angle: -90,
                    position: "insideLeft",
                    offset: 4,
                    style: { ...CHART_AXIS_TITLE, textAnchor: "middle" },
                  }}
                  domain={[0, (max: number) => Math.max(8, Math.ceil(max * 1.12))]}
                  tickFormatter={(v: number) => v.toLocaleString("en-US")}
                />
                <Tooltip
                  cursor={CHART_CURSOR}
                  formatter={(value, _name, item) => {
                    const row = item?.payload as (typeof data)[0] | undefined;
                    if (!row?.has_data) return ["No Project Track data", "Planned hours"];
                    return [`${hours(Number(value))} h`, "Planned hours"];
                  }}
                  labelFormatter={(_, payload) => String(payload?.[0]?.payload?.label ?? "")}
                  contentStyle={CHART_TOOLTIP}
                  labelStyle={{ color: "var(--color-ink)", fontWeight: 500, marginBottom: 4 }}
                />
                <Bar dataKey="planned" fill="var(--color-primary)" isAnimationActive={false} maxBarSize={32} radius={[4, 4, 0, 0]}>
                  <LabelList
                    dataKey="displayHours"
                    content={(props) => <ValueLabel {...(props as unknown as ValueLabelProps)} />}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Planned hours by month for {detail.project.name}</caption>
        <thead>
          <tr>
            <th>Month</th>
            <th>Planned hours</th>
          </tr>
        </thead>
        <tbody>
          {detail.trend.map((t) => (
            <tr key={t.month}>
              <td>{t.label}</td>
              <td>{hours(t.planned_hours)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

type ProjectEmployee = ProjectDetail["employees"][number];

/** Employee sticky column: name, code, one muted meta line (no tag chips). */
function EmployeeCell({ emp }: { emp: ProjectEmployee }) {
  const meta = [emp.grade, emp.capability, emp.location].filter(Boolean).join(" · ");
  return (
    <div className="min-w-0">
      <Link
        to={`/employee?emp=${encodeURIComponent(emp.key)}`}
        title={`Open ${emp.name} in Employee 360`}
        className="block truncate font-medium leading-5 text-ink hover:underline underline-offset-2"
      >
        {emp.name}
      </Link>
      <span className={`mt-0.5 block ${tableBodyId}`}>{emp.code}</span>
      {meta ? (
        <p className={`mt-0.5 truncate ${tableBodyMeta}`} title={meta}>
          {meta}
        </p>
      ) : null}
    </div>
  );
}

/** Phone layout: one block per employee with a month strip that scrolls sideways. */
function EmployeeAllocationList({ detail }: { detail: ProjectDetail }) {
  return (
    <ul aria-label="Employee allocation by month" className="divide-y divide-hairline md:hidden">
      {detail.employees.map((emp) => (
        <li key={emp.key} className="px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <EmployeeCell emp={emp} />
            </div>
            <span className="shrink-0 text-right">
              <span className="block text-xs text-muted">Total</span>
              <span className="text-sm font-medium tabular-nums text-ink">{hours(emp.total)}</span>
            </span>
          </div>
          <div
            className="-mx-3 mt-2.5 overflow-x-auto px-3 pb-1"
            tabIndex={0}
            role="region"
            aria-label={`Monthly hours for ${emp.name}`}
          >
            <ul className="flex w-max gap-1.5">
              {emp.cells.map((cell) => (
                <li
                  key={cell.month}
                  className="flex w-14 shrink-0 flex-col items-center gap-0.5 rounded-md border border-hairline bg-canvas/40 px-1 py-1.5 text-center"
                >
                  <span className="text-xs text-muted">{compactMonth(cell.month)}</span>
                  <span className="text-xs tabular-nums text-ink-soft">
                    {cell.state === "hours" ? (
                      hours(cell.hours)
                    ) : cell.state === "dash" ? (
                      <span className="text-muted" title="Employee assigned, hours not recorded">
                        {EM_DASH}
                      </span>
                    ) : (
                      <span className="text-hairline" aria-hidden="true">
                        ·
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmployeeAllocation({ detail }: { detail: ProjectDetail }) {
  if (detail.employees.length === 0) {
    return <EmptyBlock message="No employees are associated with this project in the reporting period" />;
  }
  return (
    <>
    <EmployeeAllocationList detail={detail} />
    {/* The surrounding PanelScrollFrame is the scroll area and frame, so the table carries no border of its own. */}
    <table className={`${tableClassMatrix} hidden w-max min-w-full md:table`} aria-label="Employee allocation by month">
      <thead>
        <tr>
          <th scope="col" className={`${tableStickyColClass} w-[13.5rem] min-w-[13.5rem]`}>
            Employee
          </th>
          {detail.months.map((m) => (
            <th key={m.key} scope="col" title={m.label} className="min-w-[4.25rem] text-right">
              {compactMonth(m.key)}
            </th>
          ))}
          <th scope="col" className={`${tableTotalColClass} min-w-[4.75rem] text-right`}>
            Total
          </th>
        </tr>
      </thead>
      <tbody>
        {detail.employees.map((emp) => (
          <tr key={emp.key}>
            <th scope="row" className={`${tableStickyColClass} w-[13.5rem] min-w-[13.5rem]`}>
              <EmployeeCell emp={emp} />
            </th>
            {emp.cells.map((cell) => (
              <td key={cell.month} className="text-right">
                {cell.state === "hours" ? (
                  <TableHourCell>{hours(cell.hours)}</TableHourCell>
                ) : cell.state === "dash" ? (
                  <TableHourCell muted title="Employee assigned, hours not recorded">
                    <TableEmpty title="Hours not recorded" />
                  </TableHourCell>
                ) : (
                  <TableHourCell muted>
                    <span className="text-hairline" aria-hidden="true">
                      ·
                    </span>
                  </TableHourCell>
                )}
              </td>
            ))}
            <td className={`${tableTotalColClass} text-right`}>
              <TableNumeric strong className="inline-flex justify-end">
                {hours(emp.total)}
              </TableNumeric>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    </>
  );
}

function ProjectDropdown({
  selectedId,
  project,
  options,
  onSelect,
}: {
  selectedId: string;
  project: ProjectDetail["project"];
  options: ProjectListOption[];
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const parsedOptions = useMemo(() => options.map((o) => ({ ...parseProjectOption(o), raw: o })), [options]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return parsedOptions;
    return parsedOptions.filter((o) => o.id.toLowerCase().includes(q) || o.name.toLowerCase().includes(q));
  }, [filter, parsedOptions]);

  const pick = (id: string) => {
    setOpen(false);
    setFilter("");
    onSelect(id);
  };

  return (
    <div ref={rootRef} className="relative w-full">
      <label id="project-select-label" className={profileControlLabel}>
        Project
      </label>
      <button
        type="button"
        id="project-select"
        aria-labelledby="project-select-label"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="project-select-list"
        onClick={() => setOpen((value) => !value)}
        className={`${projectSelectTrigger} flex h-14 min-h-14 items-center justify-between gap-2.5 px-3 text-left ${open ? "border-primary ring-2 ring-primary/15" : ""}`}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"
          >
            <FolderKanban className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1 py-0.5">
            <ProjectIdentityGrid id={project.id} name={project.name} />
          </span>
        </span>
        <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-muted ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute inset-x-0 z-30 mt-2 overflow-hidden rounded-xl border border-hairline bg-surface shadow-(--shadow-popover) sm:inset-x-auto sm:right-0 sm:w-full sm:min-w-[26rem]">
          <div className="border-b border-hairline px-3 py-3">
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Search by name or ID"
                className={`${fieldClass} h-10 pl-9`}
                autoFocus
              />
            </div>
          </div>
          <div
            className={`${projectIdentityGrid} ${projectIdentityCols} border-b border-hairline bg-canvas/40 px-3.5 py-2 text-[11px] font-semibold tracking-wide text-muted uppercase`}
            aria-hidden="true"
          >
            <span>Project ID</span>
            <span />
            <span>Project name</span>
          </div>
          <ul id="project-select-list" role="listbox" aria-label="Projects" className="max-h-72 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-4 py-4 text-sm text-muted">No projects match your search</li>
            ) : (
              filtered.map((option) => {
                const active = option.id === selectedId;
                return (
                  <li key={option.id} role="option" aria-selected={active}>
                    <button
                      type="button"
                      onClick={() => pick(option.id)}
                      className={`flex w-full items-center gap-2 px-3.5 py-2.5 text-left hover:bg-canvas ${active ? "bg-primary-soft/50" : ""}`}
                    >
                      <span className="min-w-0 flex-1">
                        <ProjectIdentityGrid
                          id={option.id}
                          name={option.name}
                          idClass="text-xs font-semibold tabular-nums text-ink-soft"
                          nameClass="line-clamp-2 text-[13px] font-medium leading-snug text-ink"
                        />
                      </span>
                      {active && <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          <div className="border-t border-hairline px-4 py-2.5 text-xs tabular-nums text-muted">
            {integer(filtered.length)} {filtered.length === 1 ? "project" : "projects"}
            {filter.trim() ? " match" : ""}
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectProfileOverview({
  detail,
  hiddenByFilters,
  monthOptions,
  selectedMonths,
  onMonthsChange,
  switcher,
}: {
  detail: ProjectDetail;
  hiddenByFilters: boolean;
  monthOptions: { value: string; label: string; hint?: string }[];
  selectedMonths: string[];
  onMonthsChange: (months: string[]) => void;
  switcher: ReactNode;
}) {
  const { project, summary, months, trend } = detail;
  const tone = projectStatusTone(project.status);
  const windowLabel = reportingWindowLabel(months);
  const monthsWithHours = trend.filter((t) => t.has_data && t.planned_hours !== null).length;
  const description = project.description?.trim();

  const scheduleLine =
    summary.start || summary.end
      ? [summary.start && `Starts ${shortDate(summary.start)}`, summary.end && `Ends ${shortDate(summary.end)}`]
          .filter(Boolean)
          .join(" · ")
      : null;

  return (
    <section
      aria-labelledby="project-profile-heading"
      className="overflow-hidden rounded-xl border border-hairline bg-surface shadow-(--shadow-card)"
    >
      <div className="border-b border-hairline bg-linear-to-b from-canvas/80 to-surface px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div
              aria-hidden="true"
              className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-surface text-primary ring-1 ring-hairline shadow-(--shadow-card)"
            >
              <FolderKanban className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium tracking-wide text-muted">Project profile</p>
              <h1
                id="project-profile-heading"
                className="mt-0.5 break-words text-xl font-semibold tracking-tight text-ink sm:text-[1.375rem] sm:leading-8"
              >
                {project.name}
              </h1>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-md border border-hairline bg-surface px-2 py-0.5 text-xs font-semibold tabular-nums text-ink-soft">
                  {project.id}
                </span>
                <span className="text-[12px] text-muted">{text(project.client_bu)}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Pill bg={tone.bg} fg={tone.fg}>
                  {project.status}
                </Pill>
                <span className="inline-flex h-6 items-center rounded-md border border-hairline bg-surface/80 px-2 text-xs font-medium text-ink-soft">
                  {text(project.contract_category)}
                </span>
                {hiddenByFilters && <FlagBadge>Hidden by current list filters</FlagBadge>}
              </div>
              {scheduleLine ? <p className="mt-2 text-[12px] text-muted">{scheduleLine}</p> : null}
            </div>
          </div>
          <div className="w-full min-w-0 shrink-0 sm:max-w-md xl:max-w-[22rem]">
            <ProjectProfileStats
              plannedHours={summary.planned_hours}
              employees={summary.employees}
              monthCount={months.length}
            />
          </div>
        </div>
      </div>

      <div className="border-b border-hairline bg-canvas/25 px-5 py-4 sm:px-6">
        <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">Reporting context</p>
        <p className="mt-0.5 text-[12px] text-muted">Choose months and switch project without returning to the portfolio.</p>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="flex min-w-0 flex-col">
            <MultiSelect
              label="Reporting months"
              labelClassName={profileControlLabel}
              triggerClassName={profileFilterTrigger}
              options={monthOptions}
              selected={selectedMonths}
              onChange={onMonthsChange}
            />
            <p className="mt-1.5 text-xs text-muted">Allocations and KPIs use {windowLabel.toLowerCase()}</p>
          </div>
          <div className="flex min-w-0 flex-col lg:max-w-none">{switcher}</div>
        </div>
      </div>

      <div className="px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-[13px] font-semibold text-ink">Project record</h2>
            <p className="mt-0.5 text-[12px] text-muted">Master data from Project Track for this engagement</p>
          </div>
          <span className="text-xs tabular-nums text-muted">{integer(monthsWithHours)} months with hours</span>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-hairline bg-surface">
          <div className="grid grid-cols-1 lg:grid-cols-2 lg:divide-x lg:divide-hairline">
            <ProjectRecordSection title="Contract and client">
              <ProjectFactRow label="Client or business unit" value={text(project.client_bu)} />
              <ProjectFactRow label="Contract category" value={text(project.contract_category)} />
              <ProjectFactRow label="Contract type" value={text(project.contract_type)} />
              <ProjectFactRow label="Project lead" value={text(project.lead)} />
            </ProjectRecordSection>
            <ProjectRecordSection title="Schedule and reporting">
              <ProjectFactRow label="Start date" value={shortDate(summary.start)} numeric />
              <ProjectFactRow label="End date" value={shortDate(summary.end)} numeric />
              <ProjectFactRow label="Reporting window" value={windowLabel} />
              <ProjectFactRow label="Months with data" value={integer(monthsWithHours)} numeric />
            </ProjectRecordSection>
          </div>
          {description ? (
            <div className="border-t border-hairline bg-canvas/20 px-4 py-4 sm:px-5">
              <h3 className="text-[11px] font-semibold tracking-wide text-muted uppercase">Description</h3>
              <p className="mt-2 max-w-3xl whitespace-pre-wrap text-[13px] leading-relaxed text-ink-soft">{description}</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="border-t border-hairline bg-canvas/30 px-5 py-4 sm:px-6">
        <h2 id="project-kpi-heading" className="text-[13px] font-semibold text-ink">
          Snapshot · {windowLabel}
        </h2>
        <p className="mt-0.5 text-[12px] text-muted">Key totals for the reporting months selected above</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Employees" icon={UsersRound} value={summary.employees} caption="With allocation rows in view" />
          <KpiCard
            label="Planned hours"
            icon={ClipboardList}
            value={summary.planned_hours !== null ? hours(summary.planned_hours) : undefined}
            caption="Across selected months"
          />
          <KpiCard label="Months in view" icon={CalendarClock} value={months.length} caption="In the allocation matrix" />
          <KpiCard
            label="Months with data"
            icon={TrendingUp}
            tone="success"
            value={monthsWithHours}
            caption="Months with planned hours"
          />
        </div>
      </div>
    </section>
  );
}

function ProjectWorkPanel({ detail }: { detail: ProjectDetail }) {
  const windowLabel = reportingWindowLabel(detail.months);
  const employeeCount = detail.employees.length;
  const monthCount = detail.months.length;
  const trendCount = detail.trend.length;

  return (
    <section aria-labelledby="project-work-heading">
      <SectionHeader
        id="project-work-heading"
        title="Team and effort"
        subtitle={`Allocation matrix and monthly trend for ${windowLabel}. Open an employee name to view their Employee 360 profile.`}
      />
      <div className="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-2">
        <Card
          className="flex min-h-0 flex-col"
          title="Team allocation"
          titleId="project-team-heading"
          subtitle={`${employeeCount} ${employeeCount === 1 ? "employee" : "employees"} · ${monthCount} reporting ${monthCount === 1 ? "month" : "months"}. Hover a month header for the full label.`}
        >
          <PanelScrollFrame
            axis="both"
            flush
            viewportClass={PROJECT_TEAM_VIEWPORT}
            hint={
              monthCount > 6
                ? `Scroll sideways for all ${monthCount} months. · means no record, ${EM_DASH} means hours are assigned but not verified.`
                : `· means no record, ${EM_DASH} means hours are assigned but not verified.`
            }
          >
            <EmployeeAllocation detail={detail} />
          </PanelScrollFrame>
        </Card>
        <Card
          className="flex min-h-0 flex-col"
          title="Monthly hours trend"
          titleId="project-trend-heading"
          subtitle="Total planned hours per month across the full project reporting window."
          actions={<span className="text-xs tabular-nums text-muted">{trendCount} months</span>}
        >
          <PanelScrollFrame
            axis="x"
            flush
            hint={
              trendCount > 8
                ? "Chart uses the full reporting window — scroll horizontally to see every month. Bar labels show hours when data exists."
                : "Bar labels show planned hours when Project Track has data for that month."
            }
          >
            <ProjectTrend detail={detail} />
          </PanelScrollFrame>
        </Card>
      </div>
    </section>
  );
}

export function ProjectsPage() {
  const url = useUrlFilters();
  const months = url.getAll("months");
  const contract = url.getAll("cc");
  const coverage = url.getOne("coverage") || COVERAGE_DEFAULT;
  const search = url.getOne("q");
  const selectedId = url.getOne("project");

  const options = useApi<ProjectOptions>("/projects/options");
  const params = { months, contract_category: contract, search };
  const overview = useApi<ProjectsOverview>(selectedId ? "/projects" : null, { ...params, coverage });
  const detail = useApi<ProjectDetail>(selectedId ? `/projects/${encodeURIComponent(selectedId)}` : null, { months });

  const hiddenByFilters = Boolean(
    selectedId && overview.data && !overview.data.rows.some((r) => r.id === selectedId),
  );

  const monthOptions =
    options.data?.months.map((m) => ({
      value: String(m.key),
      label: m.label,
      hint: m.has_data ? undefined : "No data",
    })) ?? [];

  if (!selectedId) {
    return <ProjectsDirectory onOpen={(id) => url.setValues({ project: id })} />;
  }

  const project = detail.data?.project;

  return (
    <PageZones>
      <button
        type="button"
        onClick={() => url.setValues({ project: null })}
        className="-mb-2 inline-flex h-8 touch:h-11 w-fit items-center gap-1.5 rounded-lg pr-2 text-[12px] font-medium text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        All projects
      </button>

      {detail.error && <ErrorBlock message={detail.error} onRetry={detail.reload} />}
      {!detail.error && !detail.data && <LoadingBlock height={420} label="Loading project" />}

      {detail.data && !detail.error && project && (
        <>
          <ProjectProfileOverview
            detail={detail.data}
            hiddenByFilters={hiddenByFilters}
            monthOptions={monthOptions}
            selectedMonths={months}
            onMonthsChange={(values) => url.setValues({ months: values })}
            switcher={
              <ProjectDropdown
                selectedId={selectedId}
                project={project}
                options={options.data?.projects ?? []}
                onSelect={(id) => url.setValues({ project: id })}
              />
            }
          />
          <ProjectWorkPanel detail={detail.data} />
        </>
      )}
    </PageZones>
  );
}
