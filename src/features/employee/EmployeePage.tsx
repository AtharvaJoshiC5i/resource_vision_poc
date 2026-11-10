import { Fragment, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ArrowLeft,
  CalendarCheck,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  CalendarDays,
  Clock,
  Search,
  UserRound,
} from "lucide-react";

import type {
  AllocationChild,
  AllocationRow,
  AvailabilityStatus,
  EmployeeDetail,
  EmployeeMonthRow,
  EmployeeOption,
  Meta,
} from "../../api/types";
import {
  Card,
  EmptyBlock,
  ErrorBlock,
  FlagBadge,
  KpiCard,
  LoadingBlock,
  PageHeader,
  Pill,
  SectionHeader,
  StatusBadge,
  fieldClass,
  TableEmpty,
  TableFrame,
  TableNumeric,
  tableClassDense,
  tableClassProseHeader,
  tableHeadClass,
} from "../../components/ui/primitives";
import { useApi } from "../../hooks/useApi";
import { useUrlFilters } from "../../hooks/useUrlFilters";
import { CHART_AXIS, CHART_AXIS_TITLE, CHART_CURSOR, CHART_GRID } from "../../lib/chart";
import { EM_DASH, compactMonth, hours, integer, shortDate, text } from "../../lib/format";
import { STATUS_STYLE, projectStatusTone } from "../../lib/status";
import { PageZones } from "../../components/layout/pageZones";
import { EmployeeDirectory } from "./EmployeeDirectory";
import { resolveDirectoryReportingMonth } from "./directoryMonth";

const AVAILABILITY_CHART_HEIGHT = 220;
/** Shared scroll region when Projects and Availability sit side by side. */
const WORK_PANEL_SCROLL = "overflow-x-auto xl:max-h-[min(22rem,42dvh)] xl:overflow-y-auto";

function isStatus(value: string | null): value is AvailabilityStatus {
  return value !== null && value in STATUS_STYLE;
}

/** "2026-11-06" -> 202611, the month key format used by the API. */
function monthKeyOf(iso: string | undefined): number | null {
  if (!iso) return null;
  const [year, month] = iso.split("-").map(Number);
  return year && month ? year * 100 + month : null;
}

function resolveFocusMonth(months: EmployeeMonthRow[], urlMonth: string, todayMonth: number | null): number {
  const parsed = Number(urlMonth);
  if (urlMonth && months.some((m) => m.month === parsed)) return parsed;
  if (todayMonth !== null && months.some((m) => m.month === todayMonth)) return todayMonth;
  return months.find((m) => m.present)?.month ?? months[0]?.month ?? 0;
}

function StatusCell({ status }: { status: string | null }) {
  if (!status) return <span className="text-muted">{EM_DASH}</span>;
  return isStatus(status) ? <StatusBadge status={status} /> : <span>{status}</span>;
}

/* ----------------------------------------------------------------------------- availability over time */
function MonthlyTable({ detail, focusMonth }: { detail: EmployeeDetail; focusMonth: number | null }) {
  return (
    <TableFrame tabIndex={0} role="region" aria-label="Monthly allocation and availability">
      <table className={`${tableClassDense} min-w-[20rem]`}>
          <thead>
            <tr>
              <th className={`${tableHeadClass} text-left`} scope="col">
                Month
              </th>
              <th className={`${tableHeadClass} text-right`} scope="col" title="Planned hours">
                Planned
              </th>
              <th className={`${tableHeadClass} text-right`} scope="col" title="Hours needing review">
                Review
              </th>
              <th className={`${tableHeadClass} text-right`} scope="col" title="Remaining hours">
                Free
              </th>
              <th className={tableHeadClass} scope="col">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {detail.months.map((m: EmployeeMonthRow) => (
              <tr
                key={m.month}
                className={`${focusMonth === m.month ? "rv-table-row--accent" : ""} ${m.present ? "text-ink-soft" : "rv-table-row--muted"}`}
              >
                <th
                  scope="row"
                  className="max-w-[7rem] truncate text-left font-medium text-ink"
                  title={
                    m.contract_category
                      ? `${m.label} · ${m.project_count} projects · ${m.contract_category}`
                      : m.label
                  }
                >
                  {compactMonth(m.month)}
                </th>
                <td className="text-right">
                  <TableNumeric strong className="inline-block w-full text-right">
                    {hours(m.planned_hours)}
                  </TableNumeric>
                </td>
                <td className="text-right">
                  <TableNumeric className="inline-block w-full text-right">{hours(m.unresolved_hours)}</TableNumeric>
                </td>
                <td className="text-right">
                  <TableNumeric className="inline-block w-full text-right">{hours(m.remaining_hours)}</TableNumeric>
                </td>
                <td
                  className="max-w-[8.5rem]"
                  title={m.status_reason ?? (m.has_data ? "No record this month" : "No Project Track data for this month")}
                >
                  {m.present ? <StatusCell status={m.status} /> : <TableEmpty title="No record this month" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
    </TableFrame>
  );
}

const TREND_SERIES = [
  { key: "planned", label: "Planned", fill: "var(--color-primary)" },
  { key: "unresolved", label: "Needs review", fill: STATUS_STYLE.Unverified.chart },
  { key: "remaining", label: "Remaining", fill: "var(--color-lavender-light)" },
] as const;

type TrendKey = (typeof TREND_SERIES)[number]["key"];
type TrendDatum = { short: string; label: string } & Partial<Record<TrendKey, number>>;

function TrendTooltip({ active, payload }: { active?: boolean; payload?: { payload: TrendDatum }[] }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="min-w-44 rounded-lg bg-surface px-3 py-2.5 text-xs shadow-(--shadow-popover)">
      <p className="mb-1.5 font-medium text-ink">{row.label}</p>
      {TREND_SERIES.map((s) => (
        <p key={s.key} className="flex items-center justify-between gap-6 py-0.5">
          <span className="flex items-center gap-2 text-ink-soft">
            <span aria-hidden="true" className="h-2 w-2 rounded-sm" style={{ background: s.fill }} />
            {s.label}
          </span>
          <span className="font-medium tabular-nums text-ink">{row[s.key] === undefined ? EM_DASH : `${hours(row[s.key])} h`}</span>
        </p>
      ))}
    </div>
  );
}

function TrendChart({ months, capacity }: { months: EmployeeMonthRow[]; capacity: number | undefined }) {
  const chartMonths = months.filter(
    (m) =>
      m.planned_hours != null ||
      (m.unresolved_hours != null && m.unresolved_hours > 0) ||
      (m.remaining_hours != null && m.remaining_hours > 0),
  );
  const data: TrendDatum[] = chartMonths.map((m) => ({
    short: compactMonth(m.month),
    label: m.label,
    planned: m.planned_hours ?? undefined,
    unresolved: m.unresolved_hours !== null && m.unresolved_hours > 0 ? m.unresolved_hours : undefined,
    remaining: m.remaining_hours !== null && m.remaining_hours > 0 ? m.remaining_hours : undefined,
  }));
  const totals = TREND_SERIES.map((s) => ({
    ...s,
    total: data.reduce((acc, d) => acc + (d[s.key] ?? 0), 0),
  }));

  return (
    <figure aria-label="Allocation trend by month" className="m-0 space-y-3">
      <ul className="flex flex-wrap gap-2">
        {totals.map((s) => (
          <li
            key={s.key}
            className="inline-flex min-w-0 items-center gap-2 rounded-md border border-hairline bg-canvas px-2.5 py-1.5 text-xs"
          >
            <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-sm" style={{ background: s.fill }} />
            <span className="text-muted">{s.label}</span>
            <span className="font-semibold tabular-nums text-ink">{hours(s.total)} h</span>
          </li>
        ))}
      </ul>
      <div
        className="rounded-lg border border-hairline bg-canvas/30 p-2"
        style={{ height: AVAILABILITY_CHART_HEIGHT }}
        aria-hidden={data.length === 0}
      >
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center px-3 text-center text-[12px] text-muted">
            No planned or remaining hours in the reporting window
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 2, bottom: 0, left: 0 }} barCategoryGap="22%">
              <CartesianGrid vertical={false} {...CHART_GRID} />
              <XAxis
                dataKey="short"
                interval="preserveStartEnd"
                minTickGap={8}
                tick={CHART_AXIS}
                tickLine={false}
                axisLine={{ stroke: "var(--color-border)" }}
                height={24}
              />
              <YAxis
                allowDecimals={false}
                tick={CHART_AXIS}
                axisLine={false}
                tickLine={false}
                width={44}
                tickFormatter={(v: number) => `${v} h`}
              />
              <Tooltip cursor={CHART_CURSOR} content={<TrendTooltip />} />
              {TREND_SERIES.map((s, i) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  stackId="h"
                  fill={s.fill}
                  stroke="var(--color-surface)"
                  strokeWidth={1}
                  isAnimationActive={false}
                  maxBarSize={22}
                  radius={i === TREND_SERIES.length - 1 ? [3, 3, 0, 0] : 0}
                />
              ))}
              {capacity !== undefined && (
                <ReferenceLine
                  y={capacity}
                  stroke="var(--color-ink-soft)"
                  strokeDasharray="4 4"
                  strokeOpacity={0.5}
                  label={{
                    value: `Capacity ${capacity} h`,
                    position: "insideTopRight",
                    style: { ...CHART_AXIS_TITLE, fontSize: 10, fill: "var(--color-muted)" },
                  }}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <table className="sr-only">
        <caption>Allocation trend by month</caption>
        <thead>
          <tr>
            <th>Month</th>
            <th>Planned</th>
            <th>Needs review</th>
            <th>Remaining</th>
          </tr>
        </thead>
        <tbody>
          {months.map((m) => (
            <tr key={m.month}>
              <td>{m.label}</td>
              <td>{hours(m.planned_hours)}</td>
              <td>{hours(m.unresolved_hours)}</td>
              <td>{hours(m.remaining_hours)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function AvailabilityOverTime({
  detail,
  capacity,
  focusMonth,
  className = "",
}: {
  detail: EmployeeDetail;
  capacity: number | undefined;
  focusMonth: number | null;
  className?: string;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const monthsWithRecords = detail.months.filter((m) => m.present).length;
  const option = (value: "chart" | "table", label: string) => (
    <button
      type="button"
      aria-pressed={view === value}
      onClick={() => setView(value)}
      className={`h-7 touch:h-10 rounded-md px-3 text-[12px] font-medium transition-colors ${
        view === value ? "bg-surface text-ink shadow-(--shadow-card)" : "text-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
  return (
    <Card
      className={`flex min-h-0 flex-col ${className}`}
      title="Availability over time"
      titleId="emp-availability-trend-heading"
      subtitle={`${monthsWithRecords} of ${detail.months.length} months with records. Blank cells are unknown, not zero.`}
      actions={
        <div role="group" aria-label="View" className="inline-flex rounded-lg border border-hairline bg-canvas p-0.5">
          {option("chart", "Chart")}
          {option("table", "Table")}
        </div>
      }
    >
      <div className={view === "table" ? WORK_PANEL_SCROLL : "min-h-0"}>
        {view === "chart" ? (
          <TrendChart months={detail.months} capacity={capacity} />
        ) : (
          <MonthlyTable detail={detail} focusMonth={focusMonth} />
        )}
      </div>
    </Card>
  );
}

function EmployeeWorkPanel({
  detail,
  capacity,
  focusMonth,
  focusLabel,
}: {
  detail: EmployeeDetail;
  capacity: number | undefined;
  focusMonth: number;
  focusLabel: string;
}) {
  const monthRows = detail.allocations.rows.filter((r) => r.month === focusMonth);
  const projectCount = new Set(monthRows.map((r) => r.project_id)).size;

  return (
    <section aria-labelledby="emp-work-heading">
      <SectionHeader
        id="emp-work-heading"
        title="Work and capacity"
        subtitle={`Allocations and availability for ${focusLabel}. The trend chart still shows the full reporting window.`}
      />
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <Card
          title="Projects"
          titleId="emp-projects-heading"
          subtitle={`${projectCount} ${projectCount === 1 ? "project" : "projects"} with records in ${focusLabel}. Expand for sub-projects.`}
        >
          <div className={WORK_PANEL_SCROLL}>
            <ProjectsTable detail={detail} focusMonth={focusMonth} />
          </div>
        </Card>
        <AvailabilityOverTime detail={detail} capacity={capacity} focusMonth={focusMonth} />
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------------- projects */
/** "Nov 2026 | P-100 - Name" -> parts (falls back to the raw label). */
function splitLabel(row: AllocationRow) {
  const [monthPart, rest = row.label] = row.label.split(" | ");
  const dash = rest.indexOf(" - ");
  return {
    month: monthPart,
    name: dash >= 0 ? rest.slice(dash + 3) : rest,
  };
}

const sum = (values: (number | null)[]) => {
  const present = values.filter((v): v is number => v !== null);
  return present.length ? present.reduce((a, b) => a + b, 0) : null;
};

function EffortHours({
  planned,
  unresolved,
  emphasize = true,
}: {
  planned: number | null;
  unresolved: number | null;
  emphasize?: boolean;
}) {
  const needsReview = unresolved !== null && unresolved > 0;
  if (planned === null && !needsReview) return <TableEmpty title="No hours recorded" />;
  return (
    <span className="inline-block text-right">
      {planned !== null && <TableNumeric strong={emphasize}>{hours(planned)}</TableNumeric>}
      {needsReview && (
        <span className="mt-0.5 block text-xs font-medium tabular-nums text-warning-ink">{hours(unresolved)} to review</span>
      )}
    </span>
  );
}

interface ProjectMonth {
  month: number;
  label: string;
  planned: number | null;
  unresolved: number | null;
  children: AllocationChild[];
}

interface EmployeeProject {
  id: string;
  name: string;
  client: string;
  status: string;
  contract: string;
  months: ProjectMonth[];
  planned: number | null;
  unresolved: number | null;
}

/** Regroups the month-by-project allocation rows into one entry per project. */
function groupByProject(rows: AllocationRow[]): EmployeeProject[] {
  const byId = new Map<string, EmployeeProject>();
  for (const row of rows) {
    const { month, name } = splitLabel(row);
    let project = byId.get(row.project_id);
    if (!project) {
      project = {
        id: row.project_id,
        name,
        client: row.client_bu,
        status: row.status,
        contract: row.contract,
        months: [],
        planned: null,
        unresolved: null,
      };
      byId.set(row.project_id, project);
    }
    const single = row.children.length === 1 ? row.children[0] : null;
    project.months.push({
      month: row.month,
      label: month,
      planned: single?.planned_hours ?? row.planned_hours,
      unresolved: single?.unresolved_hours ?? row.unresolved_hours,
      children: row.children,
    });
  }
  const projects = [...byId.values()];
  for (const p of projects) {
    p.months.sort((a, b) => a.month - b.month);
    p.planned = sum(p.months.map((m) => m.planned));
    p.unresolved = sum(p.months.map((m) => m.unresolved));
  }
  return projects.sort((a, b) => (b.planned ?? 0) - (a.planned ?? 0) || a.name.localeCompare(b.name));
}

function activeRange(p: EmployeeProject) {
  const first = p.months[0];
  const last = p.months[p.months.length - 1];
  const count = p.months.length;
  const span = first.month === last.month ? compactMonth(first.month) : `${compactMonth(first.month)} to ${compactMonth(last.month)}`;
  return { span, count: `${count} ${count === 1 ? "month" : "months"}` };
}

function projectHref(id: string) {
  return `/projects?project=${encodeURIComponent(id)}`;
}

function ProjectsTable({ detail, focusMonth }: { detail: EmployeeDetail; focusMonth: number }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const monthRows = useMemo(
    () => detail.allocations.rows.filter((r) => r.month === focusMonth),
    [detail.allocations.rows, focusMonth],
  );
  const projects = useMemo(() => groupByProject(monthRows), [monthRows]);
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (projects.length === 0) {
    const label = detail.months.find((m) => m.month === focusMonth)?.label ?? "this month";
    return <EmptyBlock message={`No project allocations recorded for ${label}`} />;
  }

  return (
    <TableFrame nested className="min-w-0" role="region" aria-label="Projects for this employee">
      <table className={`${tableClassProseHeader} min-w-[28rem]`}>
        <thead>
          <tr>
            <th className={`${tableHeadClass} min-w-[11rem] text-left`} scope="col">
              Project
            </th>
            <th className={`${tableHeadClass} min-w-[6.5rem] text-left`} scope="col">
              Status
            </th>
            <th className={`${tableHeadClass} min-w-[7rem] text-left`} scope="col">
              Active months
            </th>
            <th className={`${tableHeadClass} w-[6.5rem] text-right`} scope="col">
              Planned hours
            </th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => {
            const expanded = open.has(p.id);
            const tone = projectStatusTone(p.status);
            const range = activeRange(p);
            return (
              <Fragment key={p.id}>
                <tr className={`text-ink-soft ${expanded ? "rv-table-row--open" : ""}`}>
                  <th scope="row" className="min-w-[11rem] align-top text-left font-normal">
                    <div className="flex items-start gap-1.5">
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-label={`${expanded ? "Hide" : "Show"} monthly breakdown for ${p.name}`}
                        onClick={() => toggle(p.id)}
                        className="-ml-1 grid h-5 w-5 touch:h-10 touch:w-10 shrink-0 place-items-center rounded text-muted transition-colors hover:bg-canvas hover:text-ink"
                      >
                        <ChevronRight aria-hidden="true" className={`h-3.5 w-3.5 ${expanded ? "rotate-90" : ""}`} />
                      </button>
                      <span className="min-w-0 flex-1">
                        <Link
                          to={projectHref(p.id)}
                          title={`Open ${p.name} in Projects`}
                          className="break-words font-medium leading-5 text-ink hover:underline underline-offset-2"
                        >
                          {p.name}
                        </Link>
                        <span className="mt-0.5 block break-words text-xs leading-snug text-muted">
                          <span className="tabular-nums">{p.id}</span>
                          {p.client ? (
                            <>
                              <span aria-hidden="true"> · </span>
                              {p.client}
                            </>
                          ) : null}
                        </span>
                      </span>
                    </div>
                  </th>
                  <td className="min-w-[6.5rem] align-top">
                    <Pill bg={tone.bg} fg={tone.fg} wrap>
                      {p.status}
                    </Pill>
                    {p.contract ? (
                      <span className="mt-1 block break-words text-xs leading-snug text-muted">{p.contract}</span>
                    ) : null}
                  </td>
                  <td className="min-w-[7rem] align-top tabular-nums">
                    <span className="block break-words leading-snug text-ink-soft">{range.span}</span>
                    <span className="mt-0.5 block text-xs text-muted">{range.count}</span>
                  </td>
                  <td className="w-[6.5rem] align-top text-right tabular-nums">
                    <EffortHours planned={p.planned} unresolved={p.unresolved} />
                  </td>
                </tr>
                {expanded &&
                  p.months.map((m) => (
                    <Fragment key={`${p.id}-${m.month}`}>
                      <tr className="rv-table-row--nested">
                        <td colSpan={3} className="py-2 pl-8 pr-3">
                          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-l border-border pl-3">
                            <span className="shrink-0 font-medium text-ink">{m.label}</span>
                            {m.children.length === 1 && (
                              <span className="break-words text-xs text-muted">{m.children[0].sub_project}</span>
                            )}
                            {m.children.length > 1 && (
                              <span className="text-xs text-muted">{m.children.length} sub-projects</span>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          <EffortHours planned={m.planned} unresolved={m.unresolved} />
                        </td>
                      </tr>
                      {m.children.length > 1 &&
                        m.children.map((child) => (
                          <tr key={`${p.id}-${m.month}-${child.sub_project}`} className="rv-table-row--nested">
                            <td colSpan={3} className="py-1.5 pl-14 pr-3">
                              <span className="block break-words text-ink-soft">{child.sub_project}</span>
                            </td>
                            <td className="px-3 py-1.5 text-right tabular-nums">
                              <EffortHours planned={child.planned_hours} unresolved={child.unresolved_hours} emphasize={false} />
                            </td>
                          </tr>
                        ))}
                    </Fragment>
                  ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </TableFrame>
  );
}

/* ----------------------------------------------------------------------------- profile header */
const profileControlLabel = "mb-1.5 block text-xs font-medium tracking-wide text-ink-soft";

function ProfileDetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-hairline bg-canvas/40 px-3 py-2.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 break-words text-[13px] font-medium leading-snug text-ink">{value}</dd>
    </div>
  );
}

function EmployeeProfileOverview({
  detail,
  focusMonth,
  focusLabel,
  monthOptions,
  onFocusMonthChange,
  switcher,
}: {
  detail: EmployeeDetail;
  focusMonth: number;
  focusLabel: string;
  monthOptions: { value: string; label: string }[];
  onFocusMonthChange: (month: number) => void;
  switcher: ReactNode;
}) {
  const { profile, months } = detail;
  const matched = profile.hr_match_status === "Matched to ZingHR";
  const selected = months.find((m) => m.month === focusMonth);
  const selectedStatus = selected?.present && isStatus(selected.status) ? selected.status : undefined;
  const reviewHours =
    selected?.present && selected.unresolved_hours !== null && selected.unresolved_hours > 0 ? selected.unresolved_hours : null;
  const nextFree = months.find(
    (m) => m.month >= focusMonth && m.present && m.remaining_hours !== null && m.remaining_hours > 0,
  );
  const monthSelectId = useId();
  const metaLine = [profile.primary_capability, profile.grade, profile.location].filter(Boolean);

  return (
    <section
      aria-labelledby="employee-profile-heading"
      className="overflow-hidden rounded-xl border border-hairline bg-surface shadow-(--shadow-card)"
    >
      <div className="border-b border-hairline bg-canvas/50 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3.5">
            <div
              aria-hidden="true"
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-surface text-sm font-semibold text-purple-indigo ring-2 ring-inset ring-primary/15"
            >
              {profile.initials}
            </div>
            <div className="min-w-0 flex-1">
              <h1 id="employee-profile-heading" className="break-words text-xl font-semibold tracking-tight text-ink sm:text-[22px]">
                {profile.name}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
                <span className="tabular-nums font-medium text-ink-soft">{profile.code}</span>
                {metaLine.map((part) => (
                  <Fragment key={part}>
                    <span aria-hidden="true" className="text-hairline">
                      ·
                    </span>
                    <span>{part}</span>
                  </Fragment>
                ))}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {profile.status && (
                  <span className="inline-flex h-6 items-center gap-1.5 rounded-md border border-hairline bg-surface px-2 text-xs font-medium text-ink-soft">
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-success" />
                    {profile.status}
                  </span>
                )}
                {selectedStatus && <StatusBadge status={selectedStatus} />}
                {!matched && <FlagBadge>Missing HR match</FlagBadge>}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-col rounded-lg border border-hairline bg-surface px-3 py-2.5 text-[12px] sm:min-w-[11rem]">
            <span className="text-muted">Availability in {focusLabel}</span>
            <span className="mt-0.5 font-medium text-ink">
              {selected?.present && selected.remaining_hours !== null
                ? `${hours(selected.remaining_hours)} h remaining`
                : selected?.has_data
                  ? "No record this month"
                  : "No Project Track data"}
            </span>
          </div>
        </div>
      </div>

      <div className="border-b border-hairline px-5 py-4 sm:px-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor={monthSelectId} className={profileControlLabel}>
              Reporting month
            </label>
            <div className="relative">
              <CalendarDays
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary"
              />
              <select
                id={monthSelectId}
                value={String(focusMonth)}
                onChange={(event) => onFocusMonthChange(Number(event.target.value))}
                className={`${fieldClass} h-9 pl-9 font-medium text-ink`}
              >
                {monthOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="min-w-0">{switcher}</div>
        </div>
      </div>

      <div className="border-b border-hairline px-5 py-4 sm:px-6">
        <h2 className="text-[13px] font-semibold text-ink">Employee information</h2>
        <p className="mt-0.5 text-[12px] text-muted">HR master data and contract context for the selected month</p>
        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Role and organisation</h3>
            <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <ProfileDetailField label="Grade" value={text(profile.grade)} />
              <ProfileDetailField label="Primary capability" value={text(profile.primary_capability)} />
              <ProfileDetailField label="Secondary capability" value={text(profile.secondary_capability)} />
              <ProfileDetailField label="Division" value={text(profile.division)} />
              <ProfileDetailField label="Department" value={text(profile.department)} />
              <ProfileDetailField label="Reporting manager" value={text(profile.manager)} />
            </dl>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Contact and employment</h3>
            <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <ProfileDetailField label="Location" value={text(profile.location)} />
              <ProfileDetailField label="Country" value={text(profile.country)} />
              <ProfileDetailField label="Employment type" value={text(profile.employment_type)} />
              <ProfileDetailField label="Date of joining" value={shortDate(profile.joining_date)} />
              <ProfileDetailField
                label="Email"
                value={
                  profile.email ? (
                    <a href={`mailto:${profile.email}`} className="break-all text-primary hover:text-purple-indigo hover:underline">
                      {profile.email}
                    </a>
                  ) : (
                    text(profile.email)
                  )
                }
              />
              <ProfileDetailField label="Contract category" value={text(selected?.contract_category ?? null)} />
            </dl>
          </div>
        </div>
      </div>

      <div className="bg-canvas/30 px-5 py-4 sm:px-6">
        <h2 id="emp-kpi-heading" className="text-[13px] font-semibold text-ink">
          Availability for {focusLabel}
        </h2>
        <p className="mt-0.5 text-[12px] text-muted">Planned effort, review hours, and remaining capacity for this month</p>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Remaining capacity"
            icon={CalendarCheck}
            status={selectedStatus}
            tone="neutral"
            value={selected?.present && selected.remaining_hours !== null ? hours(selected.remaining_hours) : EM_DASH}
            unit="h"
            emphasis={selected?.present ? (selected.status ?? "No status") : undefined}
            caption={
              selected?.present
                ? `in ${focusLabel}`
                : selected?.has_data
                  ? `No record in ${focusLabel}`
                  : "No Project Track data this month"
            }
          />
          <KpiCard
            label="Next free capacity"
            icon={CalendarClock}
            tone={nextFree ? "success" : "neutral"}
            value={nextFree ? (nextFree.month === focusMonth ? "Now" : nextFree.label) : EM_DASH}
            emphasis={nextFree ? `${hours(nextFree.remaining_hours)} h` : undefined}
            caption={nextFree ? "from this month forward" : "No free capacity in the window"}
          />
          <KpiCard
            label="Planned hours"
            icon={Clock}
            value={selected?.present && selected.planned_hours !== null ? hours(selected.planned_hours) : EM_DASH}
            unit="h"
            caption={`Verified effort in ${focusLabel}`}
          />
          <KpiCard
            label="Hours needing review"
            icon={reviewHours !== null ? ClipboardList : ClipboardCheck}
            status={reviewHours !== null ? "Unverified" : undefined}
            tone="success"
            value={reviewHours !== null ? hours(reviewHours) : EM_DASH}
            unit="h"
            caption={reviewHours !== null ? "Not counted as verified" : "Nothing to review"}
          />
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------------- employee switcher */
function initialsOf(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "")).toUpperCase();
}

function EmployeeDropdown({
  selected,
  profile,
  onSelect,
}: {
  selected: string;
  profile: EmployeeDetail["profile"] | undefined;
  onSelect: (key: string | null) => void;
}) {
  const roster = useApi<EmployeeOption[]>("/employees/search", { q: "" });
  const rootRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    if (!open) return;
    filterRef.current?.focus();
    const close = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setFilter("");
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const options = useMemo(() => {
    const list = roster.data ?? [];
    const q = filter.trim().toLowerCase();
    const filtered = q
      ? list.filter(
          (o) =>
            o.label.toLowerCase().includes(q) ||
            o.key.toLowerCase().includes(q) ||
            o.code.toLowerCase().includes(q) ||
            o.name.toLowerCase().includes(q),
        )
      : list;
    return filtered;
  }, [roster.data, filter]);

  const choose = (key: string) => {
    onSelect(key);
    setFilter("");
    setCursor(0);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative w-full">
      <label id="emp-select-label" className={profileControlLabel}>
        Employee
      </label>
      <button
        type="button"
        id="emp-select"
        aria-labelledby="emp-select-label"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="emp-select-list"
        onClick={() => setOpen((value) => !value)}
        className={`${fieldClass} flex h-9 items-center justify-between gap-2 px-2.5 text-left ${open ? "border-primary ring-2 ring-primary/15" : ""}`}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span
            aria-hidden="true"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary-soft text-[11px] font-semibold text-purple-indigo"
          >
            {profile ? initialsOf(profile.name) : "—"}
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-[13px] font-medium text-ink">{profile?.name ?? "Select employee"}</span>
            {profile && <span className="block truncate text-xs tabular-nums text-muted">{profile.code}</span>}
          </span>
        </span>
        <UserRound aria-hidden="true" className="h-4 w-4 shrink-0 text-muted" />
        <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-muted ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute inset-x-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-hairline bg-surface shadow-(--shadow-popover) sm:inset-x-auto sm:right-0 sm:w-full sm:min-w-[22rem]">
          <div className="relative border-b border-hairline p-2">
            <Search aria-hidden="true" className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              ref={filterRef}
              type="search"
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value);
                setCursor(0);
              }}
              placeholder="Search by name or code"
              aria-label="Search employees"
              className="h-9 w-full rounded-lg border border-transparent bg-canvas pl-9 pr-3 text-sm touch:text-base text-ink placeholder:text-muted focus:border-primary focus:bg-surface focus:outline-none"
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setOpen(false);
                  setFilter("");
                } else if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setCursor((value) => Math.min(value + 1, options.length - 1));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setCursor((value) => Math.max(value - 1, 0));
                } else if (event.key === "Enter" && options[cursor]) {
                  event.preventDefault();
                  choose(options[cursor].key);
                }
              }}
            />
          </div>
          <ul id="emp-select-list" role="listbox" aria-labelledby="emp-select-label" className="max-h-72 overflow-y-auto p-1">
            {roster.loading && !roster.data ? (
              <li className="px-3 py-6 text-center text-sm text-muted">Loading employees…</li>
            ) : options.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-muted">No matching employees</li>
            ) : (
              options.map((option, index) => {
                const active = option.key === selected;
                const highlighted = index === cursor;
                return (
                  <li
                    key={option.key}
                    role="presentation"
                    ref={(element) => {
                      if (element && highlighted) element.scrollIntoView({ block: "nearest" });
                    }}
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      tabIndex={-1}
                      className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 touch:py-2.5 text-left ${
                        highlighted ? "bg-canvas" : "hover:bg-canvas"
                      }`}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setCursor(index)}
                      onClick={() => choose(option.key)}
                    >
                      <span
                        aria-hidden="true"
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-canvas text-xs font-medium text-ink-soft ring-1 ring-inset ring-hairline"
                      >
                        {initialsOf(option.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{option.name}</span>
                        <span className="block truncate text-xs tabular-nums text-muted">{option.code}</span>
                      </span>
                      {active && <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          <div className="border-t border-hairline px-4 py-2 text-xs tabular-nums text-muted">
            {integer(options.length)} {options.length === 1 ? "employee" : "employees"}
            {filter.trim() ? " match" : ""}
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------------- page */
export function EmployeePage() {
  const url = useUrlFilters();
  const selected = url.getOne("emp");

  const meta = useApi<Meta>("/meta");
  const detail = useApi<EmployeeDetail>(selected ? `/employees/${encodeURIComponent(selected)}` : null);
  const profile = detail.data?.profile;
  const currentMonth = monthKeyOf(meta.data?.today);
  const monthParam = url.getOne("month");
  const focusMonth =
    detail.data && !detail.error ? resolveFocusMonth(detail.data.months, monthParam, currentMonth) : 0;
  const focusLabel = detail.data?.months.find((m) => m.month === focusMonth)?.label ?? "";
  const monthOptions =
    detail.data?.months.map((m) => ({
      value: String(m.month),
      label: m.has_data ? m.label : `${m.label} (no PT data)`,
    })) ?? [];

  const listReportingKey = resolveDirectoryReportingMonth(meta.data?.window ?? [], monthParam, meta.data?.today);
  const listMonthLabel = listReportingKey
    ? meta.data?.window.find((m) => m.key === listReportingKey)?.label
    : undefined;

  if (!selected) {
    return (
      <PageZones>
        <PageHeader
          title="Employee 360"
          subtitle={
            listMonthLabel
              ? `Allocation and availability for ${listMonthLabel}. Select a reporting month below, then open a profile.`
              : "Allocation and projects for every employee"
          }
        />
        <EmployeeDirectory onOpen={(key) => url.setValues({ emp: key })} />
      </PageZones>
    );
  }

  return (
    <PageZones>
      <button
        type="button"
        onClick={() => url.setValues({ emp: null })}
        className="-mb-2 inline-flex h-8 touch:h-11 w-fit items-center gap-1.5 rounded-lg pr-2 text-[12px] font-medium text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        All employees
      </button>

      {detail.error && <ErrorBlock message={detail.error} onRetry={detail.reload} />}
      {!detail.error && !detail.data && <LoadingBlock height={420} label="Loading employee" />}

      {detail.data && !detail.error && profile && (
        <>
          <EmployeeProfileOverview
            detail={detail.data}
            focusMonth={focusMonth}
            focusLabel={focusLabel}
            monthOptions={monthOptions}
            onFocusMonthChange={(month) => url.setValues({ month: String(month) })}
            switcher={<EmployeeDropdown selected={selected} profile={profile} onSelect={(key) => url.setValues({ emp: key })} />}
          />

          <EmployeeWorkPanel detail={detail.data} capacity={meta.data?.capacity_hours} focusMonth={focusMonth} focusLabel={focusLabel} />
        </>
      )}
    </PageZones>
  );
}
