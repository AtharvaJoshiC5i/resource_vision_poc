import { Fragment, useId, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Briefcase, ChevronDown, ChevronRight, IdCard, Layers } from "lucide-react";

import type {
  AllocationChild,
  AllocationRow,
  AvailabilityStatus,
  EmployeeDetail,
  EmployeeMonthRow,
  EmployeeSkill,
  Meta,
} from "../../api/types";
import { EmptyBlock, ErrorBlock, HrMatchFlag, LoadingBlock, Pill, SegmentedControl, StatusBadge, StatusChip, buttonClass } from "../../components/ui/primitives";
import { useScrollEdges } from "../../hooks/useScrollEdges";
import { useHoverCard, type HoverCardPosition } from "../../hooks/useHoverCard";
import { tableClassDense, tableHeadClass, tableHeadLabelClass, tableTotalColClass } from "../../components/ui/tableClasses";
import { TableEmpty, TableNumeric } from "../../components/ui/tableCells";
import { Tooltip as AppTooltip } from "../../components/ui/Tooltip";
import { TableCard, TableScroll } from "../../components/ui/TableCard";
import { useApi } from "../../hooks/useApi";
import { useUrlFilters } from "../../hooks/useUrlFilters";
import { CHART_AXIS, CHART_CURSOR, CHART_GRID } from "../../lib/chart";
import { EMPTY, compactMonth, hours, shortDate, text } from "../../lib/format";
import { tenureLabel } from "../../lib/tags";
import { STATUS_ORDER, STATUS_STYLE, projectStatusTone } from "../../lib/status";
import { DashboardPage, DetailChrome } from "../../components/layout/pageZones";
import { EmployeeDirectory } from "./EmployeeDirectory";
import { remPx } from "../../lib/viewport";

function isStatus(value: string | null): value is AvailabilityStatus {
  return value !== null && value in STATUS_STYLE;
}

function employeeWindowLabel(months: EmployeeMonthRow[]) {
  if (months.length === 0) return "No months in view";
  if (months.length === 1) return months[0].label;
  return `${months[0].label} – ${months[months.length - 1].label}`;
}

function StatusCell({ status }: { status: string | null }) {
  if (!status) return <span className="text-muted">{EMPTY}</span>;
  return isStatus(status) ? (
    <StatusBadge status={status} />
  ) : (
    <span>{status}</span>
  );
}

function sumHours(months: EmployeeMonthRow[], pick: (m: EmployeeMonthRow) => number | null | undefined): number | null {
  let total = 0;
  let any = false;
  for (const m of months) {
    const v = pick(m);
    if (v == null) continue;
    total += v;
    any = true;
  }
  return any ? total : null;
}

/* ----------------------------------------------------------------------------- availability over time */
function MonthlyTable({ detail }: { detail: EmployeeDetail }) {
  const months = detail.months;
  const totals = useMemo(
    () => ({
      planned: sumHours(months, (m) => m.planned_hours),
      review: sumHours(months, (m) => (m.unresolved_hours != null && m.unresolved_hours > 0 ? m.unresolved_hours : null)),
      free: sumHours(months, (m) => m.remaining_hours),
    }),
    [months],
  );

  return (
    <TableScroll label="Monthly allocation and availability" className="rv-emp-trend-table-scroll lg:max-h-[min(24rem,46dvh)]">
      <table className={`${tableClassDense} rv-emp-trend-table w-full table-fixed`}>
        <colgroup>
          <col className="rv-emp-trend-col--month" />
          <col className="rv-emp-trend-col--num" />
          <col className="rv-emp-trend-col--num" />
          <col className="rv-emp-trend-col--num" />
          <col className="rv-emp-trend-col--status" />
        </colgroup>
        <thead>
          <tr>
            <th className={`${tableHeadClass} text-left`} scope="col">
              <span className={tableHeadLabelClass}>Month</span>
            </th>
            <th className={`${tableHeadClass} text-right`} scope="col">
              <span className={tableHeadLabelClass}>Planned h</span>
            </th>
            <th className={`${tableHeadClass} text-right`} scope="col">
              <span className={tableHeadLabelClass}>Review h</span>
            </th>
            <th className={`${tableHeadClass} text-right`} scope="col">
              <span className={tableHeadLabelClass}>Free h</span>
            </th>
            <th className={`${tableHeadClass} text-left`} scope="col">
              <span className={tableHeadLabelClass}>Status</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {months.map((m) => (
            <tr key={m.month} className={m.present ? "text-ink-soft" : "rv-table-row--muted"}>
              <th scope="row" className="text-left font-normal">
                <AppTooltip
                  content={
                    m.contract_category
                      ? `${m.label} · ${m.project_count} projects · ${m.contract_category}`
                      : m.label
                  }
                >
                  <span className="rv-emp-trend-table__month">{compactMonth(m.month)}</span>
                </AppTooltip>
              </th>
              <td className="text-right align-middle">
                <TableNumeric strong={m.planned_hours !== null}>{hours(m.planned_hours)}</TableNumeric>
              </td>
              <td className="text-right align-middle">
                <TableNumeric strong={m.unresolved_hours !== null && m.unresolved_hours > 0}>
                  {hours(m.unresolved_hours)}
                </TableNumeric>
              </td>
              <td className="text-right align-middle">
                <TableNumeric strong={m.remaining_hours !== null}>{hours(m.remaining_hours)}</TableNumeric>
              </td>
              <td className="align-middle">
                <AppTooltip
                  content={
                    m.status_reason ?? (m.has_data ? "No record this month" : "No Project Track data for this month")
                  }
                >
                  <span className="rv-emp-trend-table__status">
                    {m.present && m.status && isStatus(m.status) ? (
                      <>
                        <StatusChip status={m.status} />
                        <span className="rv-emp-trend-table__status-label">{m.status}</span>
                      </>
                    ) : m.present ? (
                      <StatusCell status={m.status} />
                    ) : (
                      <TableEmpty title="No record this month" />
                    )}
                  </span>
                </AppTooltip>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="rv-table-summary-row">
            <th scope="row" className="text-left text-xs font-semibold text-ink">
              Window total
            </th>
            <td className={`${tableTotalColClass} text-right`}>
              <TableNumeric strong>{hours(totals.planned)}</TableNumeric>
            </td>
            <td className="text-right">
              <TableNumeric strong>{hours(totals.review)}</TableNumeric>
            </td>
            <td className="text-right">
              <TableNumeric strong>{hours(totals.free)}</TableNumeric>
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </TableScroll>
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
  const hasValues = TREND_SERIES.some((s) => row[s.key] !== undefined);
  return (
    <div className="rv-emp-trend__tooltip">
      <p className="rv-emp-trend__tooltip-title">{row.label}</p>
      {!hasValues ? (
        <p className="text-muted">No hours recorded this month</p>
      ) : (
        <>
          {TREND_SERIES.map((s) => (
            <p key={s.key} className="rv-emp-trend__tooltip-row">
              <span className="inline-flex min-w-0 items-center gap-2">
                <span aria-hidden="true" className="rv-emp-trend__swatch" style={{ background: s.fill }} />
                {s.label}
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-ink">
                {row[s.key] === undefined ? EMPTY : `${hours(row[s.key])} h`}
              </span>
            </p>
          ))}
        </>
      )}
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
  const data: TrendDatum[] = months.map((m) => ({
    short: compactMonth(m.month),
    label: m.label,
    planned: m.planned_hours ?? undefined,
    unresolved:
      m.unresolved_hours !== null && m.unresolved_hours > 0 ? m.unresolved_hours : undefined,
    remaining: m.remaining_hours !== null && m.remaining_hours > 0 ? m.remaining_hours : undefined,
  }));
  const hasAnyHours = data.some((d) => TREND_SERIES.some((s) => d[s.key] !== undefined));
  const totals = TREND_SERIES.map((s) => ({
    ...s,
    total: data.reduce((acc, d) => acc + (d[s.key] ?? 0), 0),
  }));
  const plotMinWidth = Math.max(260, months.length * 34 + 56);

  return (
    <figure aria-label="Allocation trend by month" className="rv-emp-trend">
      <ul className="rv-emp-trend__legend">
        {totals.map((s) => (
          <li key={s.key}>
            <span aria-hidden="true" className="rv-emp-trend__swatch" style={{ background: s.fill }} />
            <span className="rv-emp-trend__legend-text">
              <span className="rv-emp-trend__legend-label">{s.label}</span>
              <span className="rv-emp-trend__legend-value">{hours(s.total)} h</span>
            </span>
          </li>
        ))}
        {capacity != null ? (
          <li className="rv-emp-trend__legend-capacity">
            <span aria-hidden="true" className="rv-emp-trend__capacity-mark" />
            <span className="rv-emp-trend__legend-text">
              <span className="rv-emp-trend__legend-label">Capacity</span>
              <span className="rv-emp-trend__legend-value">{hours(capacity)} h</span>
            </span>
          </li>
        ) : null}
      </ul>
      <div className="rv-emp-trend__scroll" aria-hidden={!hasAnyHours}>
        <div
          className={hasAnyHours ? "rv-emp-trend__plot" : "rv-emp-trend__plot rv-emp-trend__plot--empty"}
          style={hasAnyHours ? ({ "--rv-trend-min": `${plotMinWidth}px` } as CSSProperties) : undefined}
        >
          {!hasAnyHours ? (
            <p>No planned or remaining hours in the reporting window</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 12, right: 4, bottom: 4, left: 0 }} barCategoryGap="22%">
                <CartesianGrid vertical={false} {...CHART_GRID} />
                <XAxis
                  dataKey="short"
                  interval="preserveStartEnd"
                  minTickGap={6}
                  tick={CHART_AXIS}
                  tickLine={false}
                  axisLine={{ stroke: "var(--color-hairline)" }}
                  height={22}
                />
                <YAxis
                  allowDecimals={false}
                  tick={CHART_AXIS}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                  tickFormatter={(v: number) => `${v}`}
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
                {capacity !== undefined ? (
                  <ReferenceLine
                    y={capacity}
                    stroke="var(--color-ink-soft)"
                    strokeDasharray="5 4"
                    strokeOpacity={0.45}
                  />
                ) : null}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
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
    <TableCard
      className={`rv-emp-trend-card ${className}`.trim()}
      title="Planned hours over time"
      titleId="emp-availability-trend-heading"
      count={`${monthsWithRecords} of ${detail.months.length} months`}
      description="Hours stacked by month across the reporting window. Switch views for the same figures."
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
      footer={
        view === "table" ? (
          <p className="rv-emp-trend-card__foot">
            Blank cells are unknown for that month, not zero. Window total sums months with values.
          </p>
        ) : undefined
      }
    >
      {view === "chart" ? (
        <div className="rv-emp-trend-card__body">
          <TrendChart months={detail.months} capacity={capacity} />
        </div>
      ) : (
        <div className="rv-emp-trend-card__body rv-emp-trend-card__body--table">
          <MonthlyTable detail={detail} />
        </div>
      )}
    </TableCard>
  );
}

/** Supporting detail under the availability section: the hours chart or table, beside the projects. */
function EmployeeWorkPanel({
  detail,
  capacity,
}: {
  detail: EmployeeDetail;
  capacity: number | undefined;
}) {
  const projectCount = detail.totals.project_count;

  const totalPlanned = detail.totals.planned_hours;

  return (
    <div className="rv-emp-work-panel grid min-w-0 grid-cols-1 items-start lg:grid-cols-2">
      <AvailabilityOverTime detail={detail} capacity={capacity} />
      <TableCard
        className="rv-emp-projects-card"
          title="Projects"
          titleId="emp-projects-heading"
        count={`${projectCount} ${projectCount === 1 ? "project" : "projects"}`}
        description="Sorted by planned hours. Open a project name to view it in Projects."
        footer={
          totalPlanned === null ? (
            <p className="rv-emp-projects-card__foot">Expand a row for month-by-month and sub-project hours.</p>
          ) : undefined
        }
      >
            <ProjectsTable detail={detail} />
      </TableCard>
          </div>
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
      <div className="rv-emp-projects__empty">
      <EmptyBlock message="No project allocations recorded in the reporting window" />
      </div>
    );
  }

  return (
    <TableScroll label="Projects for this employee" className="min-w-0 lg:max-h-[min(26rem,48dvh)]">
      <table className={`${tableClassDense} rv-emp-projects-table`}>
        <colgroup>
          <col className="rv-emp-projects-col--project" />
          <col className="rv-emp-projects-col--status" />
          <col className="rv-emp-projects-col--range" />
          <col className="rv-emp-projects-col--hours" />
        </colgroup>
        <thead>
          <tr>
            <th className={`${tableHeadClass} text-left`} scope="col">
              Project
            </th>
            <th className={`${tableHeadClass} text-left`} scope="col">
              Status
            </th>
            <th className={`${tableHeadClass} text-left`} scope="col">
              Months
            </th>
            <th className={`${tableHeadClass} rv-table-total text-right`} scope="col">
              Planned h
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
                  className={`rv-emp-project__row text-ink-soft ${expanded ? "rv-table-row--open" : ""}`}
                >
                  <th scope="row" className="align-top text-left font-normal">
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-label={`${expanded ? "Hide" : "Show"} monthly breakdown for ${p.name}`}
                        onClick={() => toggle(p.id)}
                        className="rv-emp-project__toggle touch:h-10 touch:w-10"
                      >
                        <ChevronRight
                          aria-hidden="true"
                          className={`rv-emp-project__toggle-icon ${expanded ? "rv-emp-project__toggle-icon--open" : ""}`}
                        />
                      </button>
                      <span className="rv-emp-project__identity min-w-0 flex-1">
                        <AppTooltip content={p.name}>
                          <Link
                            to={projectHref(p.id)}
                            title={p.name}
                            className="rv-emp-project__name transition-colors hover:text-primary"
                          >
                            {p.name}
                          </Link>
                        </AppTooltip>
                        <span className="rv-emp-project__meta">
                          <span className="rv-emp-project__meta-line tabular-nums" title={p.id}>
                            {p.id}
                          </span>
                          {p.client ? (
                            <span className="rv-emp-project__meta-line" title={p.client}>
                              {p.client}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </div>
                  </th>
                  <td className="align-top">
                    <div className="rv-emp-project__status">
                      <AppTooltip
                        content={
                          p.contract
                            ? `${p.status} · ${p.contract}`
                            : p.client
                              ? `${p.status} · ${p.client}`
                              : p.status
                        }
                      >
                        <Pill bg={tone.bg} fg={tone.fg}>
                          <span className="min-w-0 truncate">{p.status}</span>
                        </Pill>
                      </AppTooltip>
                    </div>
                  </td>
                  <td className="align-top tabular-nums">
                    <span className="rv-emp-project__range-primary" title={range.span}>
                      {range.span}
                    </span>
                    <span className="rv-emp-project__range-secondary">{range.count}</span>
                  </td>
                  <td className="rv-table-total align-top text-right tabular-nums">
                    <EffortHours
                      planned={p.planned}
                      unresolved={p.unresolved}
                    />
                  </td>
                </tr>
                {expanded &&
                  p.months.map((m) => (
                    <Fragment key={`${p.id}-${m.month}`}>
                      <tr className="rv-table-row--nested rv-emp-project__nested">
                        <td colSpan={3} className="pr-3 pl-6">
                          <div className="rv-emp-project__nested-month">
                            <span className="rv-emp-project__nested-month-label">{m.label}</span>
                            {m.children.length === 1 ? (
                              <span className="rv-emp-project__nested-detail" title={m.children[0].sub_project}>
                                {m.children[0].sub_project}
                              </span>
                            ) : (
                              <span className="rv-emp-project__nested-detail">{m.children.length} sub-projects</span>
                            )}
                          </div>
                        </td>
                        <td className="rv-table-total px-3 text-right tabular-nums">
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
                            className="rv-table-row--nested rv-emp-project__sub"
                          >
                            <td colSpan={3} className="pr-3 pl-8">
                              <span className="rv-emp-project__sub-label" title={child.sub_project}>
                                {child.sub_project}
                              </span>
                            </td>
                            <td className="rv-table-total px-3 text-right tabular-nums">
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
    </TableScroll>
  );
}

/* ----------------------------------------------------------------------------- profile header */
function useEmployeeProfileParts(detail: EmployeeDetail) {
  const { profile, months, totals } = detail;
  const windowLabel = employeeWindowLabel(months);
  const totalsStatus =
    totals.status && isStatus(totals.status) ? totals.status : undefined;
  const reviewHours =
    totals.unresolved_hours !== null && totals.unresolved_hours > 0
      ? totals.unresolved_hours
      : null;
  const monthsWithRecords = months.filter((m) => m.present).length;
  return { profile, months, totals, windowLabel, totalsStatus, reviewHours, monthsWithRecords };
}

/** Label above value, for the expandable details grid. */
function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium leading-5 text-ink">{value}</dd>
    </div>
  );
}

const DETAILS_OPEN_KEY = "rv.employee.details.open";

function readDetailsOpen() {
  try {
    return window.sessionStorage.getItem(DETAILS_OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Who the person is, in one row. HR master data (manager, grade, division and the rest) sits behind
 * an "Employee details" disclosure, closed by default, so availability leads the page.
 */
function EmployeeProfileChrome({ detail }: { detail: EmployeeDetail }) {
  const { profile, totals, totalsStatus } = useEmployeeProfileParts(detail);
  const [open, setOpen] = useState(readDetailsOpen);
  const panelId = useId();
  const matched = profile.hr_match_status === "Matched to ZingHR";
  const metaLine = [profile.business_vertical, profile.primary_capability, profile.grade, profile.location].filter(Boolean);

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        window.sessionStorage.setItem(DETAILS_OPEN_KEY, next ? "1" : "0");
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  };

  return (
    <section
      aria-labelledby="employee-profile-heading"
      className="rv-frame overflow-hidden rounded-xl"
    >
      <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-4">
            <div
              aria-hidden="true"
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-lavender-soft/80 text-base font-semibold tracking-[-0.011em] text-purple-indigo ring-4 ring-primary-soft/60"
            >
              {profile.initials}
            </div>
            <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <h1
                id="employee-profile-heading"
                className="break-words text-xl font-semibold leading-tight tracking-[-0.019em] text-ink"
              >
                {profile.name}
              </h1>
              {totalsStatus && <StatusBadge status={totalsStatus} />}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
              <span className="rv-soft-tag">
                  {profile.code}
                </span>
                {metaLine.map((part) => (
                  <Fragment key={part}>
                  <span aria-hidden="true" className="text-border">
                      ·
                    </span>
                  <span className="text-ink-soft">{part}</span>
                  </Fragment>
                ))}
              {profile.status ? (
                <>
                  <span aria-hidden="true" className="text-border">
                    ·
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-ink-soft">
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-success" />
                    {profile.status}
                  </span>
                </>
              ) : null}
              {!matched && <HrMatchFlag className="ml-1" />}
            </p>
              </div>
            </div>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={panelId}
          className={`${buttonClass} shrink-0 self-start sm:self-center`}
        >
          <IdCard aria-hidden="true" className="h-3.5 w-3.5 text-muted" />
          {open ? "Hide employee details" : "Employee details"}
          <ChevronDown
            aria-hidden="true"
            className={`h-3.5 w-3.5 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {open ? (
        <div id={panelId} className="rv-reveal border-t border-hairline bg-canvas/30 px-4 py-4 sm:px-5">
          <div className="grid grid-cols-1 gap-x-8 gap-y-5 lg:grid-cols-2">
          <div>
              <h2 className="flex items-center gap-2 text-xs font-medium text-ink-soft">
                <Briefcase aria-hidden="true" className="h-3.5 w-3.5 text-muted" />
                Role and organisation
              </h2>
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                <DetailField label="Business vertical" value={text(profile.business_vertical)} />
                <DetailField label="Grade" value={text(profile.grade)} />
                <DetailField label="Primary capability" value={text(profile.primary_capability)} />
                <DetailField label="Secondary capability" value={text(profile.secondary_capability)} />
                <DetailField label="Division" value={text(profile.division)} />
                <DetailField label="Department" value={text(profile.department)} />
                <DetailField label="Reporting manager" value={text(profile.manager)} />
                <DetailField
                  label="Current clients"
                  value={profile.current_clients.length > 0 ? profile.current_clients.join(", ") : text(null)}
              />
            </dl>
          </div>
            <div className="lg:border-l lg:border-hairline lg:pl-8">
              <h2 className="flex items-center gap-2 text-xs font-medium text-ink-soft">
                <IdCard aria-hidden="true" className="h-3.5 w-3.5 text-muted" />
                Contact and employment
              </h2>
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                <DetailField label="Location" value={text(profile.location)} />
                <DetailField label="Country" value={text(profile.country)} />
                <DetailField label="Employment type" value={text(profile.employment_type)} />
                <DetailField label="Date of joining" value={shortDate(profile.joining_date)} />
                <DetailField label="Tenure" value={tenureLabel(profile.tenure, profile.tenure_months)} />
                <DetailField label="Contract category" value={text(totals.contract_category || null)} />
                <DetailField
                label="Email"
                value={
                  profile.email ? (
                    <a
                      href={`mailto:${profile.email}`}
                        className="break-all text-primary underline-offset-2 hover:text-purple-indigo hover:underline"
                    >
                      {profile.email}
                    </a>
                  ) : (
                    text(profile.email)
                  )
                }
              />
            </dl>
          </div>
        </div>
        </div>
      ) : null}
    </section>
  );
}

/* ----------------------------------------------------------------------------- skills */
const SKILL_PROFICIENCY_BLOCKS = [
  { id: "beginner", title: "Beginner" },
  { id: "intermediate", title: "Intermediate" },
  { id: "expert", title: "Expert" },
] as const;

type SkillProficiencyId = (typeof SKILL_PROFICIENCY_BLOCKS)[number]["id"];

function skillProficiencyBucket(level: string): SkillProficiencyId | "undocumented" | "other" {
  if (level === "Beginner") return "beginner";
  if (level === "Intermediate") return "intermediate";
  if (level === "Advanced" || level === "Expert") return "expert";
  if (level === "Not documented") return "undocumented";
  return "other";
}

function groupEmployeeSkills(skills: EmployeeSkill[]) {
  const buckets: Record<SkillProficiencyId, string[]> = {
    beginner: [],
    intermediate: [],
    expert: [],
  };
  const undocumented: string[] = [];
  const other: { name: string; level: string }[] = [];

  for (const skill of skills) {
    const bucket = skillProficiencyBucket(skill.level);
    if (bucket === "undocumented") undocumented.push(skill.name);
    else if (bucket === "other") other.push({ name: skill.name, level: skill.level });
    else if (!buckets[bucket].includes(skill.name)) buckets[bucket].push(skill.name);
  }

  for (const id of SKILL_PROFICIENCY_BLOCKS.map((b) => b.id)) {
    buckets[id].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }
  undocumented.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  return { buckets, undocumented, other };
}

function SkillChip({
  name,
  variant,
  muted = false,
}: {
  name: string;
  variant?: SkillProficiencyId;
  muted?: boolean;
}) {
  const tierClass = variant ? ` rv-emp-skills__pill--${variant}` : "";
  return (
    <AppTooltip content={name}>
      <span
        className={`rv-emp-skills__pill${tierClass}${muted ? " rv-emp-skills__pill--muted" : ""}`}
      >
        {name}
      </span>
    </AppTooltip>
  );
}

function SkillProficiencyBlock({
  title,
  items,
  variant,
}: {
  title: string;
  items: string[];
  variant: SkillProficiencyId;
}) {
  return (
    <section className={`rv-emp-skills__block rv-emp-skills__block--${variant}`} aria-label={`${title} skills`}>
      <header className="rv-emp-skills__block-head">
        <span className="rv-emp-skills__tier-mark" aria-hidden="true" />
        <h3 className="rv-emp-skills__block-title">{title}</h3>
        <span className="rv-emp-skills__block-count tabular-nums">{items.length}</span>
      </header>
      {items.length === 0 ? (
        <p className="rv-emp-skills__empty">No skills at this level</p>
      ) : (
        <ul className="rv-emp-skills__list">
          {items.map((name) => (
            <li key={name}>
              <SkillChip name={name} variant={variant} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Skills grouped by proficiency (Beginner / Intermediate / Expert) for quick scanning. */
function EmployeeSkills({ skills }: { skills: EmployeeDetail["skills"] }) {
  const grouped = useMemo(() => (skills ? groupEmployeeSkills(skills) : null), [skills]);
  const documented = skills?.filter((s) => s.level !== "Not documented").length ?? 0;

  return (
    <section aria-labelledby="employee-skills-heading" className="rv-emp-skills rv-frame overflow-hidden rounded-xl">
      <header className="rv-emp-skills__header">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <Layers aria-hidden="true" className="h-4 w-4 shrink-0 text-muted" />
          <h2 id="employee-skills-heading" className="text-sm font-medium tracking-[-0.011em] text-ink">
            Skills
          </h2>
          {skills !== null ? <span className="rv-title-count tabular-nums">{skills.length}</span> : null}
        </div>
        {skills !== null && skills.length > 0 ? (
          <p className="text-xs text-muted sm:text-right">{documented} with a documented level</p>
        ) : null}
      </header>

      {skills === null ? (
        <p className="rv-emp-skills__unavailable">Skills not available for this employee</p>
      ) : skills.length === 0 ? (
        <p className="rv-emp-skills__unavailable">No skills recorded in HR</p>
      ) : (
        <>
          <div className="rv-emp-skills__grid">
            {SKILL_PROFICIENCY_BLOCKS.map((block) => (
              <SkillProficiencyBlock
                key={block.id}
                title={block.title}
                variant={block.id}
                items={grouped!.buckets[block.id]}
              />
            ))}
          </div>
          {grouped!.undocumented.length > 0 || grouped!.other.length > 0 ? (
            <footer className="rv-emp-skills__foot">
              {grouped!.undocumented.length > 0 ? (
                <div className="rv-emp-skills__foot-block">
                  <span className="rv-emp-skills__foot-label">Level not documented</span>
                  <ul className="rv-emp-skills__list rv-emp-skills__list--foot">
                    {grouped!.undocumented.map((name) => (
                      <li key={name}>
                        <SkillChip name={name} muted />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {grouped!.other.map(({ name, level }) => (
                <div key={`${name}-${level}`} className="rv-emp-skills__foot-block">
                  <span className="rv-emp-skills__foot-label">{level}</span>
                  <ul className="rv-emp-skills__list rv-emp-skills__list--foot">
                    <li>
                      <SkillChip name={name} muted />
                    </li>
                  </ul>
                </div>
              ))}
            </footer>
          ) : null}
        </>
      )}
    </section>
  );
}

/* ----------------------------------------------------------------------------- availability */
/** One figure in the availability summary: label, value, one muted line of context. */
function SummaryStat({
  label,
  value,
  unit,
  caption,
  tone,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  caption: ReactNode;
  tone?: "warning";
}) {
  return (
    <div className="min-w-0 px-4 py-3.5 sm:px-5">
      <dt className="truncate text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-1 flex items-baseline gap-1 whitespace-nowrap">
        <span
          className={`text-xl font-semibold leading-7 tracking-[-0.019em] tabular-nums ${
            tone === "warning" ? "text-warning-ink" : "text-ink"
          }`}
        >
          {value}
        </span>
        {unit && value !== EMPTY ? <span className="text-xs font-medium text-muted">{unit}</span> : null}
      </dd>
      <dd className="mt-0.5 truncate text-xs text-muted">{caption}</dd>
      </div>
  );
}

/** One project's share of a month, for the month hover card. */
interface MonthProject {
  id: string;
  name: string;
  client: string;
  status: string;
  planned: number | null;
  unresolved: number | null;
  subProjects: number;
}

/** Allocation rows regrouped by month, largest planned hours first. */
function projectsByMonth(rows: AllocationRow[]): Map<number, MonthProject[]> {
  const byMonth = new Map<number, MonthProject[]>();
  for (const row of rows) {
    const { name } = splitLabel(row);
    const list = byMonth.get(row.month) ?? [];
    list.push({
      id: row.project_id,
      name,
      client: row.client_bu,
      status: row.status,
      planned: row.planned_hours,
      unresolved: row.unresolved_hours,
      subProjects: row.children.length,
    });
    byMonth.set(row.month, list);
  }
  for (const list of byMonth.values()) {
    list.sort((a, b) => (b.planned ?? 0) - (a.planned ?? 0) || a.name.localeCompare(b.name));
  }
  return byMonth;
}

const CARD_WIDTH = 288;
/** Tallest the card grows; the project list scrolls inside it beyond this. */
const CARD_MAX_HEIGHT = 560;

function shareOfMonth(value: number | null, total: number) {
  if (!value || total <= 0) return "0%";
  const pct = (value / total) * 100;
  return pct < 1 ? "<1%" : `${Math.round(pct)}%`;
}

/**
 * Month detail on hover or keyboard focus, laid out as a tall panel: the month and its status,
 * a capacity gauge, the hours as a short list, then every project that month with its hours and share.
 */
function MonthCard({
  month,
  projects,
  capacity,
  position,
  id,
  onEnter,
  onLeave,
}: {
  month: EmployeeMonthRow;
  projects: MonthProject[];
  capacity: number;
  position: HoverCardPosition;
  id: string;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const total = projects.reduce((sum, p) => sum + (p.planned ?? 0), 0);
  const reviewTotal = projects.reduce((sum, p) => sum + (p.unresolved ?? 0), 0);
  const planned = month.planned_hours ?? 0;
  const load = capacity > 0 ? planned / capacity : 0;
  const over = load > 1;
  const style = month.status ? STATUS_STYLE[month.status] : null;

  return createPortal(
    <div
      id={id}
      role="tooltip"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{ left: position.left, top: position.top, width: remPx(CARD_WIDTH), maxHeight: position.maxHeight }}
      className={`rv-popover fixed z-[60] flex flex-col overflow-hidden rounded-2xl bg-surface shadow-(--shadow-popover) ${
        position.side === "right" ? "origin-top-left" : "origin-top-right"
      }`}
    >
      <header className="shrink-0 px-4 pb-4 pt-4">
        <p className="text-xs font-medium text-muted">Month detail</p>
        <p className="mt-0.5 text-lg font-semibold leading-6 tracking-[-0.019em] text-ink">{month.label}</p>
        <div className="mt-2">
          {month.status ? (
            <StatusBadge status={month.status} />
          ) : (
            <span className="rv-soft-tag text-muted">
              {month.has_data ? "No record" : "No Project Track data"}
            </span>
          )}
        </div>

        <div className="mt-4">
          <div className="flex items-baseline justify-between text-xs">
            <span className="font-medium text-ink-soft">Capacity used</span>
            <span className={`font-semibold tabular-nums ${over ? "text-error-ink" : "text-ink"}`}>
              {Math.round(load * 100)}%
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-canvas" aria-hidden="true">
            <div
              className={`h-full rounded-full ${over ? "bg-error" : ""}`}
              style={{
                width: `${Math.min(100, load * 100)}%`,
                backgroundColor: over ? undefined : (style?.chart ?? "var(--color-primary)"),
              }}
            />
          </div>
        </div>

        <dl className="mt-4 divide-y divide-hairline rounded-xl border border-hairline bg-canvas/40 text-sm">
          <div className="flex items-center justify-between px-3 py-2">
            <dt className="text-muted">Planned</dt>
            <dd className="font-semibold tabular-nums text-ink">{hours(month.planned_hours)} h</dd>
          </div>
          <div className="flex items-center justify-between px-3 py-2">
            <dt className="text-muted">Free</dt>
            <dd className="font-semibold tabular-nums text-ink">{hours(month.remaining_hours)} h</dd>
          </div>
          <div className="flex items-center justify-between px-3 py-2">
            <dt className="text-muted">Capacity</dt>
            <dd className="font-medium tabular-nums text-ink-soft">{hours(capacity)} h</dd>
          </div>
          {month.unresolved_hours !== null && month.unresolved_hours > 0 ? (
            <div className="flex items-center justify-between px-3 py-2">
              <dt className="text-muted">Needs review</dt>
              <dd className="font-semibold tabular-nums text-warning-ink">{hours(month.unresolved_hours)} h</dd>
            </div>
          ) : null}
        </dl>
      </header>

      <div className="flex min-h-0 flex-1 flex-col border-t border-hairline">
        <p className="flex shrink-0 items-center justify-between px-4 pb-1 pt-3 text-xs font-medium text-muted">
          <span>Projects</span>
          <span className="rv-soft-tag tabular-nums">
            {projects.length}
          </span>
        </p>
        {projects.length === 0 ? (
          <p className="px-4 pb-5 pt-3 text-sm leading-5 text-muted">
            {!month.has_data
              ? "No Project Track data for this month."
              : month.present
                ? "A record exists, but no project hours are listed."
                : "No project allocations this month."}
          </p>
        ) : (
          <ol className="rv-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            {projects.map((p, i) => {
              const tone = projectStatusTone(p.status);
              return (
                <li key={p.id} className="flex gap-3 rounded-lg px-2 py-2.5">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-canvas text-[0.6875rem] font-semibold tabular-nums text-muted"
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-5 text-ink [overflow-wrap:anywhere]">{p.name}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                      <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: tone.fg }} />
                      <span className="truncate">
                        <span className="tabular-nums">{p.id}</span>
                        {p.client ? ` · ${p.client}` : ""}
                      </span>
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-canvas" aria-hidden="true">
                        <div
                          className="h-full rounded-full bg-primary/70"
                          style={{ width: total > 0 ? `${Math.max(3, ((p.planned ?? 0) / total) * 100)}%` : "0%" }}
                        />
                      </div>
                      <span className="w-9 shrink-0 text-right text-[0.6875rem] font-medium tabular-nums text-muted">
                        {shareOfMonth(p.planned, total)}
                      </span>
                    </div>
                    {p.unresolved !== null && p.unresolved > 0 ? (
                      <p className="mt-1 text-[0.6875rem] font-medium tabular-nums text-warning-ink">{hours(p.unresolved)} h to review</p>
                    ) : p.subProjects > 1 ? (
                      <p className="mt-1 text-[0.6875rem] text-muted">{p.subProjects} sub-projects</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 pt-0.5 text-sm font-semibold tabular-nums text-ink">
                    {p.planned !== null ? `${hours(p.planned)} h` : EMPTY}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {projects.length > 0 ? (
        <footer className="shrink-0 border-t border-hairline bg-canvas/40 px-4 py-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Total planned</span>
            <span className="font-semibold tabular-nums text-ink">{hours(total)} h</span>
          </div>
          {reviewTotal > 0 ? (
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-muted">Plus hours to review</span>
              <span className="font-medium tabular-nums text-warning-ink">{hours(reviewTotal)} h</span>
            </div>
          ) : null}
        </footer>
      ) : null}
    </div>,
    document.body,
  );
}

/** One month column: status tile with free hours, a load bar against capacity, then planned hours and project count. */
function MonthTile({
  month,
  current,
  showYear,
  projects,
  capacity,
}: {
  month: EmployeeMonthRow;
  current: boolean;
  showYear: boolean;
  projects: MonthProject[];
  capacity: number;
}) {
  const [name, year] = month.label.split(" ");
  const style = month.status ? STATUS_STYLE[month.status] : null;
  const { ref, position, show, hide, toggle, cardId } = useHoverCard<HTMLButtonElement>(remPx(CARD_WIDTH), remPx(CARD_MAX_HEIGHT));

  const load = month.planned_hours !== null && capacity > 0 ? Math.min(1, month.planned_hours / capacity) : 0;
  const over = month.planned_hours !== null && month.planned_hours > capacity;
  const count = projects.length || (month.project_count ?? 0);

  let face: ReactNode;
  if (!month.has_data) {
    face = <span className="rv-emp-month__face rv-emp-month__face--empty">No data</span>;
  } else if (!month.present || !style) {
    face = <span className="rv-emp-month__face rv-emp-month__face--muted">No record</span>;
  } else {
    face = (
      <span className="rv-emp-month__face" style={{ backgroundColor: style.bg, color: style.fg }}>
        <span className="rv-emp-month__face-head">
          <StatusChip status={month.status!} />
          {count > 0 ? <span className="rv-emp-month__count">{count}</span> : null}
        </span>
        <span className="rv-emp-month__free">
          <span className="rv-emp-month__free-value">
            {month.remaining_hours !== null ? hours(month.remaining_hours) : EMPTY}
          </span>
          <span className="rv-emp-month__free-label">Free hours</span>
        </span>
      </span>
    );
  }

  return (
    <li className="rv-emp-month">
      <p className="rv-emp-month__label">
        <span className="rv-emp-month__label-year">{showYear ? year : "\u00a0"}</span>
        <span className={`rv-emp-month__label-month ${current ? "rv-emp-month__label-month--current" : ""}`}>
          {name}
        </span>
      </p>
      <button
        ref={ref}
        type="button"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={toggle}
        aria-describedby={position ? cardId : undefined}
        aria-label={`${month.label}: ${month.status ?? (month.has_data ? "No record" : "No Project Track data")}, ${count} ${count === 1 ? "project" : "projects"}`}
        className={[
          "rv-emp-month__button",
          position ? "rv-emp-month__button--active" : "",
          current ? "rv-emp-month__button--current" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {face}
      </button>
      <div className="rv-emp-month__meter" aria-hidden="true">
        <div
          className={`rv-emp-month__meter-fill ${over ? "rv-emp-month__meter-fill--over" : ""}`}
          style={{ width: `${load * 100}%` }}
        />
      </div>
      <p className="rv-emp-month__planned">
        {month.planned_hours !== null ? `${hours(month.planned_hours)} h planned` : EMPTY}
      </p>
      {position ? (
        <MonthCard
          id={cardId}
          month={month}
          projects={projects}
          capacity={capacity}
          position={position}
          onEnter={show}
          onLeave={hide}
        />
      ) : null}
    </li>
  );
}

/**
 * The page's main section: this person's availability across the window. Four summary figures,
 * then one tile per month (status, free hours, load against capacity, planned hours). Hovering or
 * focusing a month opens its projects and hours.
 */
function EmployeeAvailability({ detail, capacity }: { detail: EmployeeDetail; capacity: number }) {
  const { months, totals, windowLabel, totalsStatus, reviewHours, monthsWithRecords } = useEmployeeProfileParts(detail);
  const scrollRef = useScrollEdges();
  const byMonth = useMemo(() => projectsByMonth(detail.allocations.rows), [detail.allocations.rows]);
  const busiest = months.reduce((best, m) => Math.max(best, byMonth.get(m.month)?.length ?? 0), 0);

  return (
    <section aria-labelledby="emp-availability-heading" className="rv-emp-availability rv-frame overflow-hidden rounded-xl">
      <header className="rv-emp-availability__header flex flex-col gap-3 border-b border-hairline lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 id="emp-availability-heading" className="text-base font-medium leading-6 tracking-[-0.011em] text-ink">
            Availability by month
          </h2>
          <p className="mt-0.5 max-w-2xl text-sm leading-5 text-muted">
            {windowLabel}. Hover or focus a month for project and hour detail.
          </p>
        </div>
        <ul aria-label="Status legend" className="rv-emp-availability__legend lg:max-w-md lg:justify-end">
          {STATUS_ORDER.map((s) => (
            <li key={s} className="rv-emp-availability__legend-item">
              <StatusChip status={s} />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </header>

      <dl className="rv-emp-availability__stats">
        <SummaryStat label="Months with records" value={monthsWithRecords} caption={`of ${months.length} months in the window`} />
        <SummaryStat
            label="Project allocations"
            value={totals.project_count}
          caption={
            busiest > 0
              ? `Up to ${busiest} ${busiest === 1 ? "project" : "projects"} in a month`
              : totalsStatus
                ? `${totalsStatus} · project-month rows`
                : "Project-month rows with data"
          }
        />
        <SummaryStat
            label="Planned hours"
          value={totals.planned_hours !== null ? hours(totals.planned_hours) : EMPTY}
            unit="h"
            caption="Verified effort across the window"
          />
        <SummaryStat
            label="Hours needing review"
          value={reviewHours !== null ? hours(reviewHours) : EMPTY}
            unit="h"
          tone={reviewHours !== null ? "warning" : undefined}
          caption={reviewHours !== null ? "Not counted as verified" : "Nothing to review"}
        />
      </dl>

      <div ref={scrollRef} className="rv-scroll rv-emp-availability__months overflow-x-auto">
        <ol
          aria-label="Availability by month"
          className="rv-emp-availability__month-grid"
          style={
            {
              "--rv-emp-month-count": months.length,
            } as React.CSSProperties
          }
        >
          {months.map((m, i) => (
            <MonthTile
              key={m.month}
              month={m}
              current={i === 0}
              showYear={i === 0 || m.month % 100 === 1}
              projects={byMonth.get(m.month) ?? []}
              capacity={capacity}
            />
          ))}
        </ol>
        </div>
      <footer className="rv-emp-availability__foot">
        <span>Tile shows free hours against {hours(capacity)} h capacity</span>
        <span className="rv-emp-availability__foot-hint">
          <span aria-hidden="true" className="h-1 w-5 rounded-full bg-primary/60" />
          Planned load
        </span>
        <span className="rv-emp-availability__foot-hint">
          <span
            aria-hidden="true"
            className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-canvas/90 px-1 text-[0.625rem] font-semibold text-ink-soft"
          >
            n
          </span>
          Projects that month
        </span>
      </footer>
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

  const backLink = (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-xs">
      <button
        type="button"
        onClick={() => url.setValues({ emp: null })}
        className="inline-flex h-8 touch:h-11 items-center rounded-md px-1.5 font-medium text-muted transition-colors hover:bg-surface hover:text-ink"
      >
        Employee 360
      </button>
      <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-border" />
      <span aria-current="page" className="truncate px-1.5 font-medium text-ink">
        {profile?.name ?? "Employee"}
      </span>
    </nav>
  );

  if (!selected) {
    return (
      <DashboardPage>
        <EmployeeDirectory pageTitle="Employee 360" />
      </DashboardPage>
    );
  }

  return (
    <DashboardPage>
      <DetailChrome>
        {backLink}
        {detail.error && <ErrorBlock message={detail.error} onRetry={detail.reload} />}
        {!detail.error && !detail.data && <LoadingBlock height={420} label="Loading employee" />}
        {detail.data && !detail.error && profile && <EmployeeProfileChrome detail={detail.data} />}
      </DetailChrome>
      {detail.data && !detail.error && profile && (
        <>
          <EmployeeSkills skills={detail.data.skills} />
          <EmployeeAvailability detail={detail.data} capacity={meta.data?.capacity_hours ?? 176} />
          <EmployeeWorkPanel detail={detail.data} capacity={meta.data?.capacity_hours} />
        </>
      )}
    </DashboardPage>
  );
}
