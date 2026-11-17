import { useId, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Building2, CalendarRange, ChevronDown, ChevronRight, FolderKanban, UsersRound } from "lucide-react";

import type { Meta, ProjectDetail, ProjectsOverview } from "../../api/types";
import { DashboardPage, DetailChrome } from "../../components/layout/pageZones";
import { EmptyBlock, ErrorBlock, FlagBadge, LoadingBlock, Pill, buttonClass } from "../../components/ui/primitives";
import { tableClassMatrix, tableStickyColClass, tableTotalColClass } from "../../components/ui/tableClasses";
import { TableEmpty, TableHourCell, TableNumeric, TableText, tableBodyId, tableBodyMeta } from "../../components/ui/tableCells";
import { Tooltip as AppTooltip } from "../../components/ui/Tooltip";
import { TableCard, TableScroll } from "../../components/ui/TableCard";
import { useApi } from "../../hooks/useApi";
import { useUrlFilters } from "../../hooks/useUrlFilters";
import { useHoverCard, type HoverCardPosition } from "../../hooks/useHoverCard";
import { useScrollEdges } from "../../hooks/useScrollEdges";
import { CHART_AXIS, CHART_AXIS_TITLE, CHART_CURSOR, CHART_FONT, CHART_GRID, CHART_TOOLTIP } from "../../lib/chart";
import { EMPTY, compactMonth, hours, integer, shortDate, text } from "../../lib/format";
import { projectStatusTone } from "../../lib/status";
import { PROJECT_TEAM_VIEWPORT, PROJECT_WORK_VIEWPORT, remPx } from "../../lib/viewport";
import { ProjectsDirectory } from "./ProjectsDirectory";


const COVERAGE_DEFAULT = "All Projects";

function reportingWindowLabel(months: ProjectDetail["months"]) {
  if (months.length === 0) return "No months selected";
  if (months.length === 1) return months[0]!.label;
  return `${months[0]!.label} – ${months[months.length - 1]!.label} (${months.length} months)`;
}

function metaReportingWindowLabel(window: Meta["window"]) {
  if (window.length === 0) return "No months in view";
  if (window.length === 1) return window[0]!.label;
  return `${window[0]!.label} – ${window[window.length - 1]!.label} (${window.length} months)`;
}

/** Bar top labels: stroke outline keeps figures readable when months are narrow. */
interface ValueLabelProps {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  /** From LabelList: planned hours for this month, or null when no bar label. */
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

function initialsOf(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return ((parts[0]![0] ?? "") + (parts[parts.length - 1]![0] ?? "")).toUpperCase();
}

/** Employee sticky column: initials, name, then code and one muted meta line. */
function EmployeeCell({ emp }: { emp: ProjectEmployee }) {
  const meta = [emp.grade, emp.capability, emp.location].filter(Boolean).join(" · ");
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <span
        aria-hidden="true"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-lavender-soft/80 text-xs font-semibold leading-none text-purple-indigo"
      >
        {initialsOf(emp.name)}
      </span>
      <div className="min-w-0">
        <AppTooltip content={`Open ${emp.name} in Employee 360`}>
          <Link
            to={`/employee?emp=${encodeURIComponent(emp.key)}`}
            className="block truncate font-medium leading-5 text-ink transition-colors hover:text-primary"
          >
            {emp.name}
          </Link>
        </AppTooltip>
        <span className={`mt-0.5 block ${tableBodyId}`}>{emp.code}</span>
        {meta ? (
          <TableText className={`mt-0.5 ${tableBodyMeta}`}>{meta}</TableText>
        ) : null}
      </div>
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
                      <AppTooltip content="Employee assigned, hours not recorded">
                        <span className="text-muted">{EMPTY}</span>
                      </AppTooltip>
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
    {/* The TableCard around this is the frame; TableScroll is the scroll area, so the table has no border. */}
    <table className={`${tableClassMatrix} hidden w-max min-w-full md:table`} aria-label="Employee allocation by month">
      <thead>
        <tr>
          <th scope="col" className={`${tableStickyColClass} w-60 min-w-60`}>
            Employee
          </th>
          {detail.months.map((m) => (
            <th key={m.key} scope="col" className="min-w-[4.25rem] text-right">
              <AppTooltip content={m.label}>
                <span className="inline-block">{compactMonth(m.key)}</span>
              </AppTooltip>
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
            <th scope="row" className={`${tableStickyColClass} w-60 min-w-60`}>
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

/** Label above value, for the expandable project details grid. */
function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium leading-5 text-ink">{value}</dd>
    </div>
  );
}

const PROJECT_DETAILS_OPEN_KEY = "rv.project.details.open";

function readProjectDetailsOpen() {
  try {
    return window.sessionStorage.getItem(PROJECT_DETAILS_OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * What the project is, in one row. The Project Track record (contract, lead, schedule, description)
 * sits behind a "Project details" disclosure, closed by default, so staffing leads the page.
 */
function ProjectProfileChrome({
  detail,
  hiddenByFilters,
  reportingWindowLabel: fullWindowLabel,
}: {
  detail: ProjectDetail;
  hiddenByFilters: boolean;
  reportingWindowLabel: string;
}) {
  const { project, summary } = detail;
  const tone = projectStatusTone(project.status);
  const [open, setOpen] = useState(readProjectDetailsOpen);
  const panelId = useId();

  const scheduleLine =
    summary.start || summary.end
      ? [summary.start && `Starts ${shortDate(summary.start)}`, summary.end && `Ends ${shortDate(summary.end)}`]
          .filter(Boolean)
          .join(" · ")
      : null;

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        window.sessionStorage.setItem(PROJECT_DETAILS_OPEN_KEY, next ? "1" : "0");
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  };

  return (
    <section
      aria-labelledby="project-profile-heading"
      className="rv-frame overflow-hidden rounded-xl"
    >
      <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div
            aria-hidden="true"
            className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-lavender-soft/80 text-purple-indigo ring-4 ring-primary-soft/60"
          >
            <FolderKanban className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <h1
                id="project-profile-heading"
                className="break-words text-xl font-semibold leading-tight tracking-[-0.019em] text-ink"
              >
                {project.name}
              </h1>
              <Pill bg={tone.bg} fg={tone.fg}>
                {project.status}
              </Pill>
              {hiddenByFilters && <FlagBadge>Hidden by current list filters</FlagBadge>}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
              <span className="rv-soft-tag">
                {project.id}
              </span>
              <span aria-hidden="true" className="text-border">
                ·
              </span>
              <span className="text-ink-soft">{text(project.client_bu)}</span>
              <span aria-hidden="true" className="text-border">
                ·
              </span>
              <span className="text-ink-soft">{text(project.contract_category)}</span>
              {scheduleLine ? (
                <>
                  <span aria-hidden="true" className="text-border">
                    ·
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-ink-soft">
                    <CalendarRange aria-hidden="true" className="h-3.5 w-3.5 text-muted" />
                    {scheduleLine}
                  </span>
                </>
              ) : null}
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
          <Building2 aria-hidden="true" className="h-3.5 w-3.5 text-muted" />
          {open ? "Hide project details" : "Project details"}
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
                <Building2 aria-hidden="true" className="h-3.5 w-3.5 text-muted" />
                Contract and client
              </h2>
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3">
                <DetailField label="Client or business unit" value={text(project.client_bu)} />
                <DetailField label="Contract category" value={text(project.contract_category)} />
                <DetailField label="Contract type" value={text(project.contract_type)} />
                <DetailField label="Project lead" value={text(project.lead)} />
              </dl>
            </div>
            <div className="lg:border-l lg:border-hairline lg:pl-8">
              <h2 className="flex items-center gap-2 text-xs font-medium text-ink-soft">
                <CalendarRange aria-hidden="true" className="h-3.5 w-3.5 text-muted" />
                Schedule and reporting
              </h2>
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3">
                <DetailField label="Start date" value={shortDate(summary.start)} />
                <DetailField label="End date" value={shortDate(summary.end)} />
                <DetailField label="Reporting window" value={fullWindowLabel} />
                <DetailField label="Months with data" value={integer(summary.months_with_planned_hours)} />
              </dl>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/* ----------------------------------------------------------------------------- staffing by month */
/** One person's hours on this project in a given month. */
interface MonthMember {
  emp: ProjectEmployee;
  hours: number | null;
  /** Assigned, but hours not recorded (the table's short dash). */
  unrecorded: boolean;
}

/** People on the project in each month, largest hours first. */
function teamByMonth(employees: ProjectEmployee[]): Map<number, MonthMember[]> {
  const byMonth = new Map<number, MonthMember[]>();
  for (const emp of employees) {
    for (const cell of emp.cells) {
      if (cell.state === "blank") continue;
      const list = byMonth.get(cell.month) ?? [];
      list.push({ emp, hours: cell.state === "hours" ? cell.hours : null, unrecorded: cell.state === "dash" });
      byMonth.set(cell.month, list);
    }
  }
  for (const list of byMonth.values()) {
    list.sort((a, b) => (b.hours ?? -1) - (a.hours ?? -1) || a.emp.name.localeCompare(b.emp.name));
  }
  return byMonth;
}

const TEAM_CARD_WIDTH = 296;
const TEAM_CARD_MAX_HEIGHT = 560;

function shareOf(value: number | null, total: number) {
  if (!value || total <= 0) return "0%";
  const pct = (value / total) * 100;
  return pct < 1 ? "<1%" : `${Math.round(pct)}%`;
}

/** Month detail on hover or focus: total hours and team size, then everyone on the project that month. */
function TeamMonthCard({
  label,
  planned,
  hasData,
  members,
  position,
  id,
  onEnter,
  onLeave,
}: {
  label: string;
  planned: number | null;
  hasData: boolean;
  members: MonthMember[];
  position: HoverCardPosition;
  id: string;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const total = members.reduce((sum, m) => sum + (m.hours ?? 0), 0);
  const unrecorded = members.filter((m) => m.unrecorded).length;
  return createPortal(
    <div
      id={id}
      role="tooltip"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{ left: position.left, top: position.top, width: remPx(TEAM_CARD_WIDTH), maxHeight: position.maxHeight }}
      className={`rv-popover fixed z-[60] flex flex-col overflow-hidden rounded-2xl bg-surface shadow-(--shadow-popover) ${
        position.side === "right" ? "origin-top-left" : "origin-top-right"
      }`}
    >
      <header className="shrink-0 px-4 pb-4 pt-4">
        <p className="text-xs font-medium text-muted">Month detail</p>
        <p className="mt-0.5 text-lg font-semibold leading-6 tracking-[-0.019em] text-ink">{label}</p>
        <dl className="mt-3 divide-y divide-hairline rounded-xl border border-hairline bg-canvas/40 text-sm">
          <div className="flex items-center justify-between px-3 py-2">
            <dt className="text-muted">Planned hours</dt>
            <dd className="font-semibold tabular-nums text-ink">{hasData ? `${hours(planned)} h` : EMPTY}</dd>
          </div>
          <div className="flex items-center justify-between px-3 py-2">
            <dt className="text-muted">Team size</dt>
            <dd className="font-semibold tabular-nums text-ink">{members.length}</dd>
          </div>
          {unrecorded > 0 ? (
            <div className="flex items-center justify-between px-3 py-2">
              <dt className="text-muted">Hours not recorded</dt>
              <dd className="font-medium tabular-nums text-warning-ink">
                {unrecorded} {unrecorded === 1 ? "person" : "people"}
              </dd>
            </div>
          ) : null}
        </dl>
      </header>

      <div className="flex min-h-0 flex-1 flex-col border-t border-hairline">
        <p className="flex shrink-0 items-center justify-between px-4 pb-1 pt-3 text-xs font-medium text-muted">
          <span>Team this month</span>
          <span className="rv-soft-tag tabular-nums">
            {members.length}
          </span>
        </p>
        {members.length === 0 ? (
          <p className="px-4 pb-5 pt-3 text-sm leading-5 text-muted">
            {hasData
              ? "Nobody in the selected months is allocated to this project this month."
              : "No Project Track data for this month."}
          </p>
        ) : (
          <ul className="rv-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            {members.map(({ emp, hours: h, unrecorded: dash }) => {
              const meta = [emp.grade, emp.capability].filter(Boolean).join(" · ");
              return (
                <li key={emp.key} className="flex gap-3 rounded-lg px-2 py-2.5">
                  <span
                    aria-hidden="true"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-lavender-soft/80 text-xs font-semibold leading-none text-purple-indigo"
                  >
                    {initialsOf(emp.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-5 text-ink [overflow-wrap:anywhere]">{emp.name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      <span className="tabular-nums">{emp.code}</span>
                      {meta ? ` · ${meta}` : ""}
                    </p>
                    {dash ? (
                      <p className="mt-1 text-[0.6875rem] font-medium text-warning-ink">Assigned, hours not recorded</p>
                    ) : (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-canvas" aria-hidden="true">
                          <div
                            className="h-full rounded-full bg-primary/70"
                            style={{ width: total > 0 ? `${Math.max(3, ((h ?? 0) / total) * 100)}%` : "0%" }}
                          />
                        </div>
                        <span className="w-9 shrink-0 text-right text-[0.6875rem] font-medium tabular-nums text-muted">
                          {shareOf(h, total)}
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 pt-0.5 text-sm font-semibold tabular-nums text-ink">
                    {h !== null ? `${hours(h)} h` : EMPTY}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {members.length > 0 ? (
        <footer className="flex shrink-0 items-center justify-between border-t border-hairline bg-canvas/40 px-4 py-3 text-sm">
          <span className="text-muted">Total across the team</span>
          <span className="font-semibold tabular-nums text-ink">{hours(total)} h</span>
        </footer>
      ) : null}
    </div>,
    document.body,
  );
}

/** One month column — same tile chrome as Employee 360 availability by month. */
function StaffingTile({
  month,
  peak,
  members,
  showYear,
  current,
}: {
  month: ProjectDetail["trend"][number];
  peak: number;
  members: MonthMember[];
  showYear: boolean;
  current: boolean;
}) {
  const [name, year] = month.label.split(" ");
  const { ref, position, show, hide, toggle, cardId } = useHoverCard<HTMLButtonElement>(remPx(TEAM_CARD_WIDTH), remPx(TEAM_CARD_MAX_HEIGHT));
  const planned = month.planned_hours ?? 0;
  const intensity = peak > 0 ? Math.min(1, planned / peak) : 0;
  const hasHours = month.has_data && planned > 0;
  const teamCount = members.length;

  let face: ReactNode;
  if (!month.has_data) {
    face = <span className="rv-emp-month__face rv-emp-month__face--empty">No data</span>;
  } else if (!hasHours) {
    face = <span className="rv-emp-month__face rv-emp-month__face--muted">No hours</span>;
  } else {
    face = (
      <span
        className="rv-emp-month__face rv-proj-month__face"
        style={{
          backgroundColor: `color-mix(in srgb, var(--color-primary) ${Math.round(8 + intensity * 24)}%, var(--color-surface))`,
          color: "var(--color-purple-indigo)",
        }}
      >
        <span className="rv-emp-month__face-head">
          {teamCount > 0 ? (
            <span className="rv-emp-month__count rv-proj-month__team">
              <UsersRound aria-hidden="true" className="h-3 w-3" strokeWidth={2} />
              {teamCount}
            </span>
          ) : null}
        </span>
        <span className="rv-emp-month__free">
          <span className="rv-emp-month__free-value">{hours(planned)}</span>
          <span className="rv-emp-month__free-label">h planned</span>
        </span>
      </span>
    );
  }

  return (
    <li className="rv-emp-month">
      <p className="rv-emp-month__label">
        <span className="rv-emp-month__label-year">{showYear ? year : "\u00a0"}</span>
        <span className={`rv-emp-month__label-month ${current ? "rv-emp-month__label-month--current" : ""}`}>{name}</span>
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
        aria-label={`${month.label}: ${hasHours ? `${hours(planned)} planned hours` : month.has_data ? "no planned hours" : "no Project Track data"}, ${teamCount} ${teamCount === 1 ? "person" : "people"}`}
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
        <div className="rv-emp-month__meter-fill" style={{ width: `${intensity * 100}%` }} />
      </div>
      <p className="rv-emp-month__planned">
        {teamCount > 0
          ? `${teamCount} ${teamCount === 1 ? "person" : "people"}`
          : hasHours
            ? `${hours(planned)} h planned`
            : EMPTY}
      </p>
      {position ? (
        <TeamMonthCard
          id={cardId}
          label={month.label}
          planned={month.planned_hours}
          hasData={month.has_data}
          members={members}
          position={position}
          onEnter={show}
          onLeave={hide}
        />
      ) : null}
    </li>
  );
}

/** One figure in the staffing summary (matches Employee 360 availability stats). */
function StaffingStat({ label, value, unit, caption }: { label: string; value: ReactNode; unit?: string; caption: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-1 flex items-baseline gap-1 whitespace-nowrap">
        <span className="text-xl font-semibold leading-7 tracking-[-0.019em] tabular-nums text-ink">{value}</span>
        {unit && value !== EMPTY ? <span className="text-xs font-medium text-muted">{unit}</span> : null}
      </dd>
      <dd className="mt-0.5 text-xs leading-snug text-muted">{caption}</dd>
    </div>
  );
}

/**
 * The page's main section: how the project is staffed across the window. Four summary figures,
 * then one tile per month shaded by planned hours; hovering a month lists the team and their hours.
 */
function ProjectStaffing({ detail, reportingWindowLabel: fullWindowLabel }: { detail: ProjectDetail; reportingWindowLabel: string }) {
  const { summary, trend, employees } = detail;
  const scrollRef = useScrollEdges();
  const byMonth = useMemo(() => teamByMonth(employees), [employees]);
  const peak = Math.max(0, ...trend.map((t) => t.planned_hours ?? 0));
  const peakMonth = trend.find((t) => (t.planned_hours ?? 0) === peak && peak > 0);
  const largestTeam = Math.max(0, ...trend.map((t) => byMonth.get(t.month)?.length ?? 0));

  return (
    <section aria-labelledby="project-staffing-heading" className="rv-emp-availability rv-frame overflow-hidden rounded-xl">
      <header className="rv-emp-availability__header flex flex-col gap-3 border-b border-hairline lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 id="project-staffing-heading" className="text-base font-medium leading-6 tracking-[-0.011em] text-ink">
            Staffing by month
          </h2>
          <p className="mt-0.5 max-w-2xl text-sm leading-5 text-muted">
            {fullWindowLabel}. Hover or focus a month for team and hour detail.
          </p>
        </div>
        <ul aria-label="Staffing legend" className="rv-emp-availability__legend lg:max-w-md lg:justify-end">
          <li className="rv-emp-availability__legend-item">
            <UsersRound aria-hidden="true" className="h-3.5 w-3.5 text-muted" />
            <span>On project</span>
          </li>
          <li className="rv-emp-availability__legend-item">
            <span aria-hidden="true" className="h-1.5 w-5 rounded-full bg-primary/60" />
            <span>Share of busiest month</span>
          </li>
        </ul>
      </header>

      <dl className="rv-emp-availability__stats">
        <StaffingStat
          label="Employees"
          value={summary.employees}
          caption={largestTeam > 0 ? `Up to ${largestTeam} in a month` : "With allocations in the window"}
        />
        <StaffingStat
          label="Planned hours"
          value={summary.planned_hours !== null ? hours(summary.planned_hours) : EMPTY}
          unit="h"
          caption="Verified planned effort in the window"
        />
        <StaffingStat
          label="Months with data"
          value={summary.months_with_planned_hours}
          caption={`of ${trend.length} months in the window`}
        />
        <StaffingStat
          label="Busiest month"
          value={peakMonth ? peakMonth.label.split(" ")[0] : EMPTY}
          caption={peakMonth ? `${hours(peak)} h planned in ${peakMonth.label}` : "No planned hours yet"}
        />
      </dl>

      <div ref={scrollRef} className="rv-scroll rv-emp-availability__months overflow-x-auto">
        <ol
          aria-label="Staffing by month"
          className="rv-emp-availability__month-grid"
          style={{ "--rv-emp-month-count": trend.length } as React.CSSProperties}
        >
          {trend.map((t, i) => (
            <StaffingTile
              key={t.month}
              month={t}
              peak={peak}
              members={byMonth.get(t.month) ?? []}
              showYear={i === 0 || t.month % 100 === 1}
              current={i === 0}
            />
          ))}
        </ol>
      </div>

      <footer className="rv-emp-availability__foot">
        <span>Tile shading compares planned hours to the busiest month</span>
        <span className="rv-emp-availability__foot-hint">
          <span aria-hidden="true" className="h-1 w-5 rounded-full bg-primary/60" />
          Relative load
        </span>
        <span className="rv-emp-availability__foot-hint">
          <span
            aria-hidden="true"
            className="inline-flex h-4 min-w-4 items-center justify-center gap-0.5 rounded-full bg-canvas/90 px-1 text-[0.625rem] font-semibold text-ink-soft"
          >
            <UsersRound className="h-2.5 w-2.5" />
          </span>
          Team that month
        </span>
      </footer>
    </section>
  );
}

function ProjectWorkPanel({ detail }: { detail: ProjectDetail }) {
  const windowLabel = reportingWindowLabel(detail.months);
  const employeeCount = detail.employees.length;

  return (
    <section aria-label={`Team and effort for ${windowLabel}`}>
      <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-2 [&>*]:h-full">
        <TableCard
          title="Team allocation"
          titleId="project-team-heading"
          count={`${employeeCount} ${employeeCount === 1 ? "employee" : "employees"}`}
        >
          {detail.employees.length === 0 ? (
            <div className="p-4 sm:p-5">
              <EmptyBlock message="No employees are associated with this project in the reporting period" />
            </div>
          ) : (
            <TableScroll label="Employee allocation by month" className={PROJECT_TEAM_VIEWPORT}>
              <EmployeeAllocation detail={detail} />
            </TableScroll>
          )}
        </TableCard>
        <TableCard title="Monthly hours trend" titleId="project-trend-heading">
          <div className={`rv-scroll overflow-x-auto overflow-y-hidden px-4 pt-4 sm:px-5 ${PROJECT_WORK_VIEWPORT}`}>
            <ProjectTrend detail={detail} />
          </div>
        </TableCard>
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

  const meta = useApi<Meta>("/meta");
  const params = { months, contract_category: contract, search };
  const overview = useApi<ProjectsOverview>(selectedId ? "/projects" : null, { ...params, coverage });
  const detail = useApi<ProjectDetail>(selectedId ? `/projects/${encodeURIComponent(selectedId)}` : null, { months });
  const fullWindowLabel = metaReportingWindowLabel(meta.data?.window ?? []);

  const hiddenByFilters = Boolean(
    selectedId && overview.data && !overview.data.rows.some((r) => r.id === selectedId),
  );

  if (!selectedId) {
    return <ProjectsDirectory onOpen={(id) => url.setValues({ project: id })} />;
  }

  const project = detail.data?.project;

  return (
    <DashboardPage>
      <DetailChrome>
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => url.setValues({ project: null })}
            className="inline-flex h-8 touch:h-11 items-center rounded-md px-1.5 font-medium text-muted transition-colors hover:bg-surface hover:text-ink"
          >
            Projects
          </button>
          <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-border" />
          <span aria-current="page" className="truncate px-1.5 font-medium text-ink">
            {project?.name ?? "Project"}
          </span>
        </nav>
        {detail.error && <ErrorBlock message={detail.error} onRetry={detail.reload} />}
        {!detail.error && !detail.data && <LoadingBlock height={420} label="Loading project" />}
        {detail.data && !detail.error && project && (
          <ProjectProfileChrome
            detail={detail.data}
            hiddenByFilters={hiddenByFilters}
            reportingWindowLabel={fullWindowLabel}
          />
        )}
      </DetailChrome>
      {detail.data && !detail.error && project && (
        <>
          <ProjectStaffing detail={detail.data} reportingWindowLabel={fullWindowLabel} />
          <ProjectWorkPanel detail={detail.data} />
        </>
      )}
    </DashboardPage>
  );
}
