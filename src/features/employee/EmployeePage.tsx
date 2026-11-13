import { Fragment, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowLeft,
  CalendarCheck,
  CalendarClock,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock,
} from "lucide-react";

import type {
  AllocationChild,
  AllocationRow,
  AvailabilityStatus,
  EmployeeDetail,
  EmployeeMonthRow,
  Meta,
} from "../../api/types";
import {
  Card,
  EmptyBlock,
  ErrorBlock,
  HrMatchFlag,
  KpiCard,
  LoadingBlock,
  PageHeader,
  Pill,
  SectionHeader,
  SegmentedControl,
  StatusBadge,
  TableFrame,
} from "../../components/ui/primitives";
import {
  tableClassDense,
  tableClassProseHeader,
  tableHeadClass,
} from "../../components/ui/tableClasses";
import { TableEmpty, TableNumeric } from "../../components/ui/tableCells";
import { useApi } from "../../hooks/useApi";
import { useUrlFilters } from "../../hooks/useUrlFilters";
import {
  CHART_AXIS,
  CHART_AXIS_TITLE,
  CHART_CURSOR,
  CHART_GRID,
} from "../../lib/chart";
import {
  EM_DASH,
  compactMonth,
  hours,
  shortDate,
  text,
} from "../../lib/format";
import { STATUS_STYLE, projectStatusTone } from "../../lib/status";
import { PageZones } from "../../components/layout/pageZones";
import { EmployeeDirectory } from "./EmployeeDirectory";
import { resolveDirectoryReportingMonth } from "./directoryMonth";

const AVAILABILITY_CHART_HEIGHT = 220;
/** Shared scroll region when Projects and Availability sit side by side. */
const WORK_PANEL_SCROLL =
  "overflow-x-auto xl:max-h-[min(22rem,42dvh)] xl:overflow-y-auto";

function isStatus(value: string | null): value is AvailabilityStatus {
  return value !== null && value in STATUS_STYLE;
}

function employeeWindowLabel(months: EmployeeMonthRow[]) {
  if (months.length === 0) return "No months in view";
  if (months.length === 1) return months[0].label;
  return `${months[0].label} – ${months[months.length - 1].label}`;
}

function StatusCell({ status }: { status: string | null }) {
  if (!status) return <span className="text-muted">{EM_DASH}</span>;
  return isStatus(status) ? (
    <StatusBadge status={status} />
  ) : (
    <span>{status}</span>
  );
}

/** Overrides default left-aligned headers so numeric columns line up with their cells. */
const EMPLOYEE_MONTHLY_TABLE = [
  tableClassDense,
  "w-full table-fixed",
  "[&_thead_th.rv-col-num]:text-right",
  "[&_thead_th.rv-col-label]:text-left",
  "[&_thead_th.rv-col-status]:text-left",
  "[&_tbody_td.rv-col-num]:text-right",
  "[&_tbody_td.rv-col-num]:tabular-nums",
].join(" ");

/* ----------------------------------------------------------------------------- availability over time */
function MonthlyTable({ detail }: { detail: EmployeeDetail }) {
  return (
    <TableFrame
      nested
      tabIndex={0}
      role="region"
      aria-label="Monthly allocation and availability"
      className="mt-0"
    >
      <table className={EMPLOYEE_MONTHLY_TABLE}>
        <colgroup>
          <col className="w-[26%]" />
          <col className="w-[18%]" />
          <col className="w-[17%]" />
          <col className="w-[17%]" />
          <col className="w-[22%]" />
        </colgroup>
        <thead>
          <tr>
            <th className={`${tableHeadClass} rv-col-label`} scope="col">
              Month
            </th>
            <th
              className={`${tableHeadClass} rv-col-num`}
              scope="col"
              title="Planned hours"
            >
              Planned
            </th>
            <th
              className={`${tableHeadClass} rv-col-num`}
              scope="col"
              title="Hours needing review"
            >
              Review
            </th>
            <th
              className={`${tableHeadClass} rv-col-num`}
              scope="col"
              title="Remaining hours"
            >
              Free
            </th>
            <th className={`${tableHeadClass} rv-col-status`} scope="col">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {detail.months.map((m: EmployeeMonthRow) => (
            <tr
              key={m.month}
              className={m.present ? "text-ink-soft" : "rv-table-row--muted"}
            >
              <th
                scope="row"
                className="rv-col-label truncate text-left font-medium text-ink"
                title={
                  m.contract_category
                    ? `${m.label} · ${m.project_count} projects · ${m.contract_category}`
                    : m.label
                }
              >
                {compactMonth(m.month)}
              </th>
              <td className="rv-col-num align-middle text-right">
                <TableNumeric strong={m.planned_hours !== null}>
                  {hours(m.planned_hours)}
                </TableNumeric>
              </td>
              <td className="rv-col-num align-middle text-right">
                <TableNumeric
                  strong={m.unresolved_hours !== null && m.unresolved_hours > 0}
                >
                  {hours(m.unresolved_hours)}
                </TableNumeric>
              </td>
              <td className="rv-col-num align-middle text-right">
                <TableNumeric strong={m.remaining_hours !== null}>
                  {hours(m.remaining_hours)}
                </TableNumeric>
              </td>
              <td
                className="rv-col-status align-middle"
                title={
                  m.status_reason ??
                  (m.has_data
                    ? "No record this month"
                    : "No Project Track data for this month")
                }
              >
                {m.present ? (
                  <StatusCell status={m.status} />
                ) : (
                  <TableEmpty title="No record this month" />
                )}
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
  {
    key: "unresolved",
    label: "Needs review",
    fill: STATUS_STYLE.Unverified.chart,
  },
  { key: "remaining", label: "Remaining", fill: "var(--color-lavender-light)" },
] as const;

type TrendKey = (typeof TREND_SERIES)[number]["key"];
type TrendDatum = { short: string; label: string } & Partial<
  Record<TrendKey, number>
>;

function TrendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: TrendDatum }[];
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="min-w-44 rounded-lg bg-surface px-3 py-2.5 text-xs shadow-(--shadow-popover)">
      <p className="mb-1.5 font-medium text-ink">{row.label}</p>
      {TREND_SERIES.map((s) => (
        <p
          key={s.key}
          className="flex items-center justify-between gap-6 py-0.5"
        >
          <span className="flex items-center gap-2 text-ink-soft">
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-sm"
              style={{ background: s.fill }}
            />
            {s.label}
          </span>
          <span className="font-medium tabular-nums text-ink">
            {row[s.key] === undefined ? EM_DASH : `${hours(row[s.key])} h`}
          </span>
        </p>
      ))}
    </div>
  );
}

function TrendChart({
  months,
  capacity,
}: {
  months: EmployeeMonthRow[];
  capacity: number | undefined;
}) {
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
    unresolved:
      m.unresolved_hours !== null && m.unresolved_hours > 0
        ? m.unresolved_hours
        : undefined,
    remaining:
      m.remaining_hours !== null && m.remaining_hours > 0
        ? m.remaining_hours
        : undefined,
  }));
  const totals = TREND_SERIES.map((s) => ({
    ...s,
    total: data.reduce((acc, d) => acc + (d[s.key] ?? 0), 0),
  }));

  return (
    <figure aria-label="Allocation trend by month" className="m-0 space-y-3">
      <ul className="flex flex-wrap gap-2">
        {totals.map((s) => (
          <li key={s.key} className="rv-chip min-w-0 bg-canvas">
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-sm"
              style={{ background: s.fill }}
            />
            <span className="text-muted">{s.label}</span>
            <span className="font-semibold tabular-nums text-ink">
              {hours(s.total)} h
            </span>
          </li>
        ))}
      </ul>
      <div
        className="rounded-xl border border-hairline bg-canvas/40 p-2 ring-1 ring-inset ring-ink/[0.02]"
        style={{ height: AVAILABILITY_CHART_HEIGHT }}
        aria-hidden={data.length === 0}
      >
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center px-3 text-center text-[12px] text-muted">
            No planned or remaining hours in the reporting window
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 4, right: 2, bottom: 0, left: 0 }}
              barCategoryGap="22%"
            >
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
                    style: {
                      ...CHART_AXIS_TITLE,
                      fontSize: 10,
                      fill: "var(--color-muted)",
                    },
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
  className = "",
}: {
  detail: EmployeeDetail;
  capacity: number | undefined;
  className?: string;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const monthsWithRecords = detail.months.filter((m) => m.present).length;
  return (
    <Card
      className={`flex min-h-0 flex-col ${className}`}
      title="Availability over time"
      titleId="emp-availability-trend-heading"
      subtitle={`${monthsWithRecords} of ${detail.months.length} months with records. Blank cells are unknown, not zero.`}
      actions={
        <SegmentedControl
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: "chart", label: "Chart" },
            { value: "table", label: "Table" },
          ]}
        />
      }
    >
      <div className={view === "table" ? WORK_PANEL_SCROLL : "min-h-0"}>
        {view === "chart" ? (
          <TrendChart months={detail.months} capacity={capacity} />
        ) : (
          <MonthlyTable detail={detail} />
        )}
      </div>
    </Card>
  );
}

function EmployeeWorkPanel({
  detail,
  capacity,
}: {
  detail: EmployeeDetail;
  capacity: number | undefined;
}) {
  const windowLabel = employeeWindowLabel(detail.months);
  const projectCount = detail.totals.project_count;

  return (
    <section aria-labelledby="emp-work-heading">
      <SectionHeader
        id="emp-work-heading"
        title="Work and capacity"
        subtitle={`Allocations and availability across ${windowLabel}.`}
      />
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <Card
          title="Projects"
          titleId="emp-projects-heading"
          subtitle={`${projectCount} ${projectCount === 1 ? "project" : "projects"} in the reporting window. Expand for monthly and sub-project detail.`}
        >
          <div className={WORK_PANEL_SCROLL}>
            <ProjectsTable detail={detail} />
          </div>
        </Card>
        <AvailabilityOverTime detail={detail} capacity={capacity} />
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
  if (planned === null && !needsReview)
    return <TableEmpty title="No hours recorded" />;
  return (
    <span className="inline-block text-right">
      {planned !== null && (
        <TableNumeric strong={emphasize}>{hours(planned)}</TableNumeric>
      )}
      {needsReview && (
        <span className="mt-0.5 block text-xs font-medium tabular-nums text-warning-ink">
          {hours(unresolved)} to review
        </span>
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
  return projects.sort(
    (a, b) =>
      (b.planned ?? 0) - (a.planned ?? 0) || a.name.localeCompare(b.name),
  );
}

function activeRange(p: EmployeeProject) {
  const first = p.months[0];
  const last = p.months[p.months.length - 1];
  const count = p.months.length;
  const span =
    first.month === last.month
      ? compactMonth(first.month)
      : `${compactMonth(first.month)} to ${compactMonth(last.month)}`;
  return { span, count: `${count} ${count === 1 ? "month" : "months"}` };
}

function projectHref(id: string) {
  return `/projects?project=${encodeURIComponent(id)}`;
}

function ProjectsTable({ detail }: { detail: EmployeeDetail }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const projects = useMemo(
    () => groupByProject(detail.allocations.rows),
    [detail.allocations.rows],
  );
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (projects.length === 0) {
    return (
      <EmptyBlock message="No project allocations recorded in the reporting window" />
    );
  }

  return (
    <TableFrame
      nested
      className="min-w-0"
      role="region"
      aria-label="Projects for this employee"
    >
      <table className={`${tableClassProseHeader} min-w-[28rem]`}>
        <thead>
          <tr>
            <th
              className={`${tableHeadClass} min-w-[11rem] text-left`}
              scope="col"
            >
              Project
            </th>
            <th
              className={`${tableHeadClass} min-w-[6.5rem] text-left`}
              scope="col"
            >
              Status
            </th>
            <th
              className={`${tableHeadClass} min-w-[7rem] text-left`}
              scope="col"
            >
              Active months
            </th>
            <th
              className={`${tableHeadClass} w-[6.5rem] text-right`}
              scope="col"
            >
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
                <tr
                  className={`text-ink-soft ${expanded ? "rv-table-row--open" : ""}`}
                >
                  <th
                    scope="row"
                    className="min-w-[11rem] align-top text-left font-normal"
                  >
                    <div className="flex items-start gap-1.5">
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-label={`${expanded ? "Hide" : "Show"} monthly breakdown for ${p.name}`}
                        onClick={() => toggle(p.id)}
                        className="-ml-1 grid h-5 w-5 touch:h-10 touch:w-10 shrink-0 place-items-center rounded text-muted transition-colors hover:bg-canvas hover:text-ink"
                      >
                        <ChevronRight
                          aria-hidden="true"
                          className={`h-3.5 w-3.5 ${expanded ? "rotate-90" : ""}`}
                        />
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
                      <span className="mt-1 block break-words text-xs leading-snug text-muted">
                        {p.contract}
                      </span>
                    ) : null}
                  </td>
                  <td className="min-w-[7rem] align-top tabular-nums">
                    <span className="block break-words leading-snug text-ink-soft">
                      {range.span}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {range.count}
                    </span>
                  </td>
                  <td className="w-[6.5rem] align-top text-right tabular-nums">
                    <EffortHours
                      planned={p.planned}
                      unresolved={p.unresolved}
                    />
                  </td>
                </tr>
                {expanded &&
                  p.months.map((m) => (
                    <Fragment key={`${p.id}-${m.month}`}>
                      <tr className="rv-table-row--nested">
                        <td colSpan={3} className="py-2 pl-8 pr-3">
                          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-l border-border pl-3">
                            <span className="shrink-0 font-medium text-ink">
                              {m.label}
                            </span>
                            {m.children.length === 1 && (
                              <span className="break-words text-xs text-muted">
                                {m.children[0].sub_project}
                              </span>
                            )}
                            {m.children.length > 1 && (
                              <span className="text-xs text-muted">
                                {m.children.length} sub-projects
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          <EffortHours
                            planned={m.planned}
                            unresolved={m.unresolved}
                          />
                        </td>
                      </tr>
                      {m.children.length > 1 &&
                        m.children.map((child) => (
                          <tr
                            key={`${p.id}-${m.month}-${child.sub_project}`}
                            className="rv-table-row--nested"
                          >
                            <td colSpan={3} className="py-1.5 pl-14 pr-3">
                              <span className="block break-words text-ink-soft">
                                {child.sub_project}
                              </span>
                            </td>
                            <td className="px-3 py-1.5 text-right tabular-nums">
                              <EffortHours
                                planned={child.planned_hours}
                                unresolved={child.unresolved_hours}
                                emphasize={false}
                              />
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
function ProfileDetailField({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-hairline bg-canvas/40 px-3 py-2.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 break-words text-[13px] font-medium leading-snug text-ink">
        {value}
      </dd>
    </div>
  );
}

function EmployeeProfileOverview({ detail }: { detail: EmployeeDetail }) {
  const { profile, months, totals } = detail;
  const matched = profile.hr_match_status === "Matched to ZingHR";
  const windowLabel = employeeWindowLabel(months);
  const totalsStatus =
    totals.status && isStatus(totals.status) ? totals.status : undefined;
  const reviewHours =
    totals.unresolved_hours !== null && totals.unresolved_hours > 0
      ? totals.unresolved_hours
      : null;
  const monthsWithRecords = months.filter((m) => m.present).length;
  const metaLine = [
    profile.primary_capability,
    profile.grade,
    profile.location,
  ].filter(Boolean);

  return (
    <section
      aria-labelledby="employee-profile-heading"
      className="overflow-hidden rounded-xl border border-hairline bg-surface shadow-(--shadow-card) ring-1 ring-inset ring-ink/[0.03]"
    >
      <div className="border-b border-hairline bg-canvas/50 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3.5">
            <div
              aria-hidden="true"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface text-xs font-semibold text-purple-indigo ring-2 ring-inset ring-primary/15"
            >
              {profile.initials}
            </div>
            <div className="min-w-0 flex-1">
              <h1
                id="employee-profile-heading"
                className="break-words text-lg font-medium tracking-tight text-ink sm:text-xl"
              >
                {profile.name}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
                <span className="tabular-nums font-medium text-ink-soft">
                  {profile.code}
                </span>
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
                  <span className="rv-chip h-6 gap-1.5 text-ink-soft">
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 rounded-full bg-success"
                    />
                    {profile.status}
                  </span>
                )}
                {totalsStatus && <StatusBadge status={totalsStatus} />}
                {!matched && <HrMatchFlag />}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-col rounded-lg border border-hairline bg-surface px-3 py-2.5 text-[12px] sm:min-w-[11rem]">
            <span className="text-muted">Reporting window</span>
            <span className="mt-0.5 font-medium text-ink">{windowLabel}</span>
            <span className="mt-1 text-muted">
              {totals.planned_hours !== null
                ? `${hours(totals.planned_hours)} h planned`
                : "No planned hours in window"}
            </span>
          </div>
        </div>
      </div>

      <div className="border-b border-hairline px-5 py-4 sm:px-6">
        <h2 className="text-base font-medium text-ink">Employee information</h2>
        <p className="mt-0.5 text-[12px] text-muted">
          HR master data and contract context for the reporting window
        </p>
        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <h3 className="rv-eyebrow">Role and organisation</h3>
            <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <ProfileDetailField label="Grade" value={text(profile.grade)} />
              <ProfileDetailField
                label="Primary capability"
                value={text(profile.primary_capability)}
              />
              <ProfileDetailField
                label="Secondary capability"
                value={text(profile.secondary_capability)}
              />
              <ProfileDetailField
                label="Division"
                value={text(profile.division)}
              />
              <ProfileDetailField
                label="Department"
                value={text(profile.department)}
              />
              <ProfileDetailField
                label="Reporting manager"
                value={text(profile.manager)}
              />
            </dl>
          </div>
          <div>
            <h3 className="rv-eyebrow">Contact and employment</h3>
            <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <ProfileDetailField
                label="Location"
                value={text(profile.location)}
              />
              <ProfileDetailField
                label="Country"
                value={text(profile.country)}
              />
              <ProfileDetailField
                label="Employment type"
                value={text(profile.employment_type)}
              />
              <ProfileDetailField
                label="Date of joining"
                value={shortDate(profile.joining_date)}
              />
              <ProfileDetailField
                label="Email"
                value={
                  profile.email ? (
                    <a
                      href={`mailto:${profile.email}`}
                      className="break-all text-primary hover:text-purple-indigo hover:underline"
                    >
                      {profile.email}
                    </a>
                  ) : (
                    text(profile.email)
                  )
                }
              />
              <ProfileDetailField
                label="Contract category"
                value={text(totals.contract_category || null)}
              />
            </dl>
          </div>
        </div>
      </div>

      <div className="bg-canvas/30 px-5 py-4 sm:px-6">
        <h2 id="emp-kpi-heading" className="text-base font-medium text-ink">
          Availability across the window
        </h2>
        <p className="mt-0.5 text-[12px] text-muted">
          Window totals for {windowLabel}
        </p>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Months with records"
            icon={CalendarClock}
            tone="neutral"
            value={monthsWithRecords}
            caption={`of ${months.length} months in the window`}
          />
          <KpiCard
            label="Project allocations"
            icon={CalendarCheck}
            status={totalsStatus}
            tone="neutral"
            value={totals.project_count}
            emphasis={totalsStatus}
            caption="Project-month rows with data"
          />
          <KpiCard
            label="Planned hours"
            icon={Clock}
            value={
              totals.planned_hours !== null
                ? hours(totals.planned_hours)
                : EM_DASH
            }
            unit="h"
            caption="Verified effort across the window"
          />
          <KpiCard
            label="Hours needing review"
            icon={reviewHours !== null ? ClipboardList : ClipboardCheck}
            status={reviewHours !== null ? "Unverified" : undefined}
            tone="success"
            value={reviewHours !== null ? hours(reviewHours) : EM_DASH}
            unit="h"
            caption={
              reviewHours !== null
                ? "Not counted as verified"
                : "Nothing to review"
            }
          />
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------------- page */
export function EmployeePage() {
  const url = useUrlFilters();
  const selected = url.getOne("emp");

  const meta = useApi<Meta>("/meta");
  const detail = useApi<EmployeeDetail>(
    selected ? `/employees/${encodeURIComponent(selected)}` : null,
  );
  const profile = detail.data?.profile;
  const monthParam = url.getOne("month");

  const listReportingKey = resolveDirectoryReportingMonth(
    meta.data?.window ?? [],
    monthParam,
    meta.data?.today,
  );
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
              ? `Allocation and availability for ${listMonthLabel}. Use filters to set reporting months, then open a profile.`
              : "Allocation and projects for every employee. Use filters to set reporting months, then open a profile."
          }
        />
        <EmployeeDirectory />
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

      {detail.error && (
        <ErrorBlock message={detail.error} onRetry={detail.reload} />
      )}
      {!detail.error && !detail.data && (
        <LoadingBlock height={420} label="Loading employee" />
      )}

      {detail.data && !detail.error && profile && (
        <>
          <EmployeeProfileOverview detail={detail.data} />

          <EmployeeWorkPanel
            detail={detail.data}
            capacity={meta.data?.capacity_hours}
          />
        </>
      )}
    </PageZones>
  );
}
