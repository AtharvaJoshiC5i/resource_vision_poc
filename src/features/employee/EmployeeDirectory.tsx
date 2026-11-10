import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  ChevronsUpDown,
  CircleDashed,
  Search,
  TriangleAlert,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";

import type { AvailabilityStatus, DirectoryRow, EmployeeDirectory as DirectoryData, Meta, MonthOption } from "../../api/types";
import {
  Card,
  EmptyBlock,
  ErrorBlock,
  HrMatchFlag,
  KpiCard,
  LoadingBlock,
  MetaField,
  Pagination,
  SectionHeader,
  StatusBadge,
  buttonClass,
  fieldClass,
  labelClass,
  quietButtonClass,
  HoursMetricPill,
  TableEmpty,
  TableFrame,
  TableNumeric,
  TableText,
  rowChevronClass,
  tableBodyId,
  tableBodyMeta,
  tableClassInteractive,
  tableHeadClass,
  tableRowActionClass,
  tableStickyColClass,
  type KpiTone,
} from "../../components/ui/primitives";
import { sortIconClass } from "../../components/ui/tableStyles";
import { useApi } from "../../hooks/useApi";
import { useUrlFilters } from "../../hooks/useUrlFilters";
import { EM_DASH, hours, integer, text } from "../../lib/format";
import { SelectField } from "../../components/ui/MultiSelect";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import { resolveDirectoryReportingMonth } from "./directoryMonth";
import { STATUS_ICON, STATUS_ORDER } from "../../lib/status";

const PAGE_SIZE = 25;
const LIST_LIMIT = 5;
const NO_RECORD = "No record";

function ReportingMonthField({
  value,
  options,
  onChange,
}: {
  value: number;
  options: MonthOption[];
  onChange: (month: number) => void;
}) {
  const id = useId();
  const selectedLabel = options.find((m) => m.key === value)?.label ?? "";
  return (
    <div className="min-w-0 w-full sm:max-w-sm">
      <label htmlFor={id} className={labelClass}>
        Reporting month
      </label>
      <div className="relative">
        <CalendarDays
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary"
        />
        <select
          id={id}
          value={String(value)}
          onChange={(event) => onChange(Number(event.target.value))}
          className={`${fieldClass} pl-9 font-medium text-ink`}
          aria-label={selectedLabel ? `Reporting month: ${selectedLabel}` : "Reporting month"}
        >
          {options.map((option) => (
            <option key={option.key} value={option.key}>
              {option.has_data ? option.label : `${option.label} (no PT data)`}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

type SortKey = "name" | "utilisation" | "projects" | "available";
const SORT_KEYS: SortKey[] = ["name", "utilisation", "projects", "available"];
const SORT_LABELS: Record<SortKey, string> = {
  name: "Employee",
  utilisation: "Allocation",
  projects: "Projects",
  available: "Available from",
};

function initialsOf(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "")).toUpperCase();
}

function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-lavender-soft/70 text-xs font-semibold text-purple-indigo ring-1 ring-inset ring-primary/10"
    >
      {initialsOf(name)}
    </span>
  );
}

function shareOf(count: number, total: number) {
  if (total <= 0) return "0%";
  const pct = (count / total) * 100;
  return pct > 0 && pct < 1 ? "<1%" : `${Math.round(pct)}%`;
}

/* ----------------------------------------------------------------------------- summary metrics */
interface DirectoryMetric {
  value: string;
  label: string;
  count: number;
  status?: AvailabilityStatus;
  icon: LucideIcon;
  tone?: KpiTone;
}

function DirectorySummary({
  monthLabel,
  total,
  tiles,
  children,
}: {
  monthLabel: string;
  total: number;
  tiles: DirectoryMetric[];
  children: ReactNode;
}) {
  return (
    <section aria-labelledby="directory-status-heading">
      <SectionHeader
        id="directory-status-heading"
        title={`Team in ${monthLabel}`}
        subtitle="Headline counts for this month. Use filters below the summary to narrow the table."
      />
      <div className="@container">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7">
        {tiles.map((tile) => {
          const isAll = tile.value === "";
          return (
            <KpiCard
              key={tile.label}
              label={tile.label}
              value={tile.count}
              status={tile.status}
              icon={tile.icon}
              tone={tile.tone}
              emphasis={isAll ? undefined : shareOf(tile.count, total)}
              caption={isAll ? "Everyone in the directory" : "of employees"}
            />
          );
        })}
      </div>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/* ----------------------------------------------------------------------------- short lists */
function PersonButton({ name, code, onOpen, children }: { name: string; code: string; onOpen: () => void; children: ReactNode }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 px-2 py-2.5 text-left transition-colors hover:bg-canvas sm:rounded-lg"
      >
        <Avatar name={name} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">{name}</span>
          <span className="block truncate text-xs tabular-nums text-muted">{code}</span>
        </span>
        {children}
      </button>
    </li>
  );
}

function AttentionListBody({ data, onOpen }: { data: DirectoryData["attention"]; onOpen: (key: string) => void }) {
  if (data.items.length === 0) return <EmptyBlock message="Nobody needs attention this month" />;
  return (
    <ul className="-mx-2 divide-y divide-hairline">
      {data.items.slice(0, LIST_LIMIT).map((item) => (
        <PersonButton key={item.key} name={item.name} code={item.code} onOpen={() => onOpen(item.key)}>
          <span className="flex shrink-0 flex-col items-end gap-1 text-right">
            <StatusBadge status={item.status} />
            <span className="max-w-52 break-words text-xs text-muted">{item.reason}</span>
          </span>
        </PersonButton>
      ))}
    </ul>
  );
}

function FreeingListBody({ data, onOpen }: { data: DirectoryData["freeing"]; onOpen: (key: string) => void }) {
  if (data.items.length === 0) return <EmptyBlock message="No capacity is expected to free up in this period" />;
  return (
    <ul className="-mx-2 divide-y divide-hairline">
      {data.items.slice(0, LIST_LIMIT).map((item) => (
        <PersonButton key={item.key} name={item.name} code={item.code} onOpen={() => onOpen(item.key)}>
          <span className="flex shrink-0 flex-col items-end gap-0.5">
            <span className="text-sm font-medium tabular-nums text-success-ink">+{hours(item.hours_freed)} h</span>
            <span className="text-xs text-muted">from {item.label}</span>
          </span>
        </PersonButton>
      ))}
    </ul>
  );
}

function ActNowModal({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  const dialogRef = useDialogFocus(open);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-ink/40 backdrop-blur-[1px]" onClick={onClose} />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="act-now-dialog-title"
        className="relative flex pb-[env(safe-area-inset-bottom)] outline-none max-h-[min(85dvh,28rem)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-hairline bg-surface shadow-(--shadow-popover) ring-1 ring-inset ring-ink/[0.03] sm:rounded-2xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-hairline px-5 py-4">
          <div>
            <h2 id="act-now-dialog-title" className="text-base font-medium text-ink">
              {title}
            </h2>
            <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 touch:h-11 touch:w-11 place-items-center rounded-full border border-transparent text-muted transition-colors hover:border-hairline hover:bg-canvas hover:text-ink"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="rv-scroll min-h-0 overflow-y-auto px-5 py-3">{children}</div>
      </div>
    </div>
  );
}

function ActNowBar({
  attentionTotal,
  freeingTotal,
  onAttention,
  onFreeing,
}: {
  attentionTotal: number;
  freeingTotal: number;
  onAttention: () => void;
  onFreeing: () => void;
}) {
  const alertBtn =
    "inline-flex h-8 touch:h-10 items-center gap-2 rounded-lg border px-2.5 text-xs font-medium shadow-(--shadow-card) transition-[border-color,box-shadow] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none";
  return (
    <div className="rv-inset-panel flex flex-wrap gap-2 py-2.5">
      <button
        type="button"
        disabled={attentionTotal === 0}
        onClick={onAttention}
        className={`${alertBtn} border-error/25 bg-error-soft text-error-ink hover:border-error/40`}
      >
        <TriangleAlert aria-hidden="true" className="h-4 w-4 shrink-0" />
        Needs attention
        <span className="rounded-md bg-surface/80 px-1.5 py-0.5 text-xs font-semibold tabular-nums">{integer(attentionTotal)}</span>
      </button>
      <button
        type="button"
        disabled={freeingTotal === 0}
        onClick={onFreeing}
        className={`${alertBtn} border-success/25 bg-success-soft text-success-ink hover:border-success/40`}
      >
        <CalendarClock aria-hidden="true" className="h-4 w-4 shrink-0" />
        Freeing up soon
        <span className="rounded-md bg-surface/80 px-1.5 py-0.5 text-xs font-semibold tabular-nums">{integer(freeingTotal)}</span>
      </button>
    </div>
  );
}

/* ----------------------------------------------------------------------------- directory table */
function AllocationCell({ row }: { row: DirectoryRow }) {
  if (row.utilisation === null || row.status === null) {
    return <TableEmpty title="No allocation data for this month" />;
  }
  return (
    <HoursMetricPill consumed={hours(row.planned_hours)} capacity={hours(row.capacity_hours)} />
  );
}

function AvailableFromCell({ row, currentMonth }: { row: DirectoryRow; currentMonth: number }) {
  if (row.status === null || row.available_from === null) {
    return <TableEmpty title="No free capacity found in the reporting window" />;
  }
  const now = row.available_from.month === currentMonth;
  return (
    <span className="block min-w-[5.5rem] whitespace-nowrap">
      <span className={`block text-[13px] font-medium leading-5 ${now ? "text-success-ink" : "text-ink"}`}>
        {now ? "Now" : row.available_from.label}
      </span>
      <span className={`block ${tableBodyMeta} tabular-nums`}>{hours(row.available_from.remaining_hours)} h free</span>
    </span>
  );
}

function SortHeader({
  label,
  sortKey,
  active,
  descending,
  align = "left",
  className = "",
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  active: boolean;
  descending: boolean;
  align?: "left" | "right";
  className?: string;
  onSort: (key: SortKey) => void;
}) {
  const Icon = !active ? ChevronsUpDown : descending ? ArrowDown : ArrowUp;
  return (
    <th
      scope="col"
      aria-sort={active ? (descending ? "descending" : "ascending") : "none"}
      className={`${tableHeadClass} ${align === "right" ? "text-right" : ""} ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="group/sort -mx-1 inline-flex items-center gap-1 rounded px-1 touch:py-2.5"
      >
        {label}
        <Icon aria-hidden="true" className={sortIconClass(active)} />
      </button>
    </th>
  );
}

function compare(a: DirectoryRow, b: DirectoryRow, key: SortKey): number {
  const nullsLast = (x: number | null, y: number | null) => (x === null ? (y === null ? 0 : 1) : y === null ? -1 : x - y);
  switch (key) {
    case "utilisation":
      return nullsLast(a.utilisation, b.utilisation);
    case "projects":
      return nullsLast(a.projects, b.projects);
    case "available":
      return nullsLast(a.available_from?.month ?? null, b.available_from?.month ?? null);
    default:
      return a.name.localeCompare(b.name) || a.code.localeCompare(b.code);
  }
}

function distinct(rows: DirectoryRow[], pick: (row: DirectoryRow) => string | null) {
  return [...new Set(rows.map(pick).filter((v): v is string => !!v))].sort((x, y) => x.localeCompare(y));
}

function FilterSelect({
  label,
  allLabel,
  value,
  options,
  onChange,
}: {
  label: string;
  allLabel: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${fieldClass} ${value ? "font-medium text-ink" : "text-ink-soft"}`}
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ----------------------------------------------------------------------------- page body */
const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All statuses" },
  ...STATUS_ORDER.map((s) => ({ value: s, label: s })),
  { value: NO_RECORD, label: "No record" },
];

export function EmployeeDirectory({ onOpen }: { onOpen: (key: string) => void }) {
  const url = useUrlFilters();
  const meta = useApi<Meta>("/meta");
  const monthParam = url.getOne("month");
  const reportingMonth = useMemo(
    () => resolveDirectoryReportingMonth(meta.data?.window ?? [], monthParam, meta.data?.today),
    [meta.data, monthParam],
  );

  useEffect(() => {
    if (!meta.data || monthParam || reportingMonth === undefined) return;
    url.setValues({ month: String(reportingMonth) });
  }, [meta.data, monthParam, reportingMonth, url]);

  const api = useApi<DirectoryData>(
    reportingMonth !== undefined ? "/employees/directory" : null,
    reportingMonth !== undefined ? { month: reportingMonth } : {},
  );
  const [attentionOpen, setAttentionOpen] = useState(false);
  const [freeingOpen, setFreeingOpen] = useState(false);

  const query = url.getOne("q");
  const status = url.getOne("status");
  const capability = url.getOne("cap");
  const grade = url.getOne("grade");
  const location = url.getOne("loc");
  const sortParam = url.getOne("sort") as SortKey;
  const sort: SortKey = SORT_KEYS.includes(sortParam) ? sortParam : "name";
  const descending = url.getOne("dir") === "desc";
  const page = Math.max(1, Number(url.getOne("page")) || 1);

  const rows = useMemo(() => api.data?.rows ?? [], [api.data]);
  const capabilities = useMemo(() => distinct(rows, (r) => r.capability), [rows]);
  const grades = useMemo(() => distinct(rows, (r) => r.grade), [rows]);
  const locations = useMemo(() => distinct(rows, (r) => r.location), [rows]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = rows.filter(
      (r) =>
        (!needle || r.name.toLowerCase().includes(needle) || r.code.toLowerCase().includes(needle)) &&
        (!status || (status === NO_RECORD ? r.status === null : r.status === status)) &&
        (!capability || r.capability === capability) &&
        (!grade || r.grade === grade) &&
        (!location || r.location === location),
    );
    const sorted = [...list].sort((a, b) => compare(a, b, sort));
    return descending ? sorted.reverse() : sorted;
  }, [rows, query, status, capability, grade, location, sort, descending]);

  if (api.error) return <ErrorBlock message={api.error} onRetry={api.reload} />;
  if (!api.data) return <LoadingBlock height={520} label="Loading employees" />;

  const data = api.data;
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const filtering = Boolean(query || status || capability || grade || location);

  const setFilter = (updates: Record<string, string | null>) => url.setValues({ ...updates, page: null });
  const onSort = (key: SortKey) => {
    if (sort === key) url.setValues({ dir: descending ? null : "desc", page: null });
    else url.setValues({ sort: key === "name" ? null : key, dir: key === "name" ? null : "desc", page: null });
  };

  const k = data.kpis;
  const statusTile = (status: AvailabilityStatus, label: string, count: number): DirectoryMetric => ({
    value: status,
    label,
    count,
    status,
    icon: STATUS_ICON[status],
  });
  const tiles: DirectoryMetric[] = [
    { value: "", label: "All employees", count: k.total, icon: UsersRound },
    statusTile("Fully Available", "Fully available", k.fully_available),
    statusTile("Partially Available", "Partially available", k.partially_available),
    statusTile("Fully Committed", "Fully committed", k.fully_committed),
    statusTile("Over-allocated", "Over-allocated", k.over_allocated),
    statusTile("Unverified", "Unverified", k.unverified),
    { value: NO_RECORD, label: "No record", count: k.no_record, icon: CircleDashed, tone: "neutral" },
  ];
  const openFromAlert = (key: string) => {
    setAttentionOpen(false);
    setFreeingOpen(false);
    onOpen(key);
  };

  return (
    <>
      <section aria-labelledby="act-now-heading">
        <SectionHeader
          id="act-now-heading"
          title="Act now"
          subtitle="Open an alert to review people who need a decision or will free up capacity soon"
        />
        <ActNowBar
          attentionTotal={data.attention.total}
          freeingTotal={data.freeing.total}
          onAttention={() => setAttentionOpen(true)}
          onFreeing={() => setFreeingOpen(true)}
        />
      </section>

      <ActNowModal
        open={attentionOpen}
        onClose={() => setAttentionOpen(false)}
        title="Needs attention"
        subtitle="Over-allocated or unverified this month"
      >
        <AttentionListBody data={data.attention} onOpen={openFromAlert} />
      </ActNowModal>
      <ActNowModal
        open={freeingOpen}
        onClose={() => setFreeingOpen(false)}
        title="Freeing up soon"
        subtitle={`Remaining capacity grows within the next ${data.freeing.months} months`}
      >
        <FreeingListBody data={data.freeing} onOpen={openFromAlert} />
      </ActNowModal>

      <section
        aria-labelledby="reporting-month-heading"
        className="rounded-xl border border-hairline bg-surface px-4 py-4 shadow-(--shadow-card) ring-1 ring-inset ring-ink/[0.03] sm:px-5 sm:py-5"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 max-w-xl">
            <h2 id="reporting-month-heading" className="text-base font-medium text-ink">
              Reporting month
            </h2>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">
              Status pills, allocation columns, and summary KPIs below all use this month. Changing it reloads the directory.
            </p>
          </div>
          {meta.data && reportingMonth !== undefined && (
            <ReportingMonthField
              value={reportingMonth}
              options={meta.data.window}
              onChange={(month) => url.setValues({ month: String(month), page: null })}
            />
          )}
        </div>
      </section>

      <DirectorySummary monthLabel={data.month_label} total={k.total} tiles={tiles}>

      <Card
        title="Employees"
        titleId="employees-directory-heading"
        subtitle={`Allocation for ${data.month_label}. Select a person to open their profile.`}
        actions={
          <span className="text-[12px] tabular-nums text-muted" aria-live="polite">
            <span className="font-medium text-ink-soft">{integer(filtered.length)}</span>
            {filtering ? ` of ${integer(rows.length)}` : ""} {filtered.length === 1 ? "employee" : "employees"}
          </span>
        }
      >
        <div className="mb-4 rounded-xl border border-hairline bg-canvas/40 p-3.5 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="rv-eyebrow">Find employees</p>
            {filtering && (
              <button
                type="button"
                onClick={() => url.setValues({ q: null, status: null, cap: null, grade: null, loc: null, page: null })}
                className={quietButtonClass}
              >
                <X aria-hidden="true" className="h-3.5 w-3.5" />
                Clear filters
              </button>
            )}
          </div>
          <div className="@container">
          <div
            role="group"
            aria-label="Employee filters"
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 2xl:items-end"
          >
            <div className="min-w-0 @md:col-span-2">
              <label htmlFor="employee-directory-search" className={labelClass}>
                Search
              </label>
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                />
                <input
                  id="employee-directory-search"
                  type="search"
                  value={query}
                  onChange={(event) => setFilter({ q: event.target.value || null })}
                  placeholder="Name or code"
                  className={`${fieldClass} pl-9`}
                />
              </div>
            </div>
            <SelectField
              label="Availability status"
              value={status}
              options={STATUS_FILTER_OPTIONS}
              onChange={(value) => setFilter({ status: value || null })}
            />
            <FilterSelect
              label="Capability"
              allLabel="All capabilities"
              value={capability}
              options={capabilities}
              onChange={(v) => setFilter({ cap: v || null })}
            />
            <FilterSelect
              label="Grade"
              allLabel="All grades"
              value={grade}
              options={grades}
              onChange={(v) => setFilter({ grade: v || null })}
            />
            <FilterSelect
              label="Location"
              allLabel="All locations"
              value={location}
              options={locations}
              onChange={(v) => setFilter({ loc: v || null })}
            />
          </div>
          </div>
        </div>

        {visible.length === 0 ? (
          <EmptyBlock message="No employees match these filters" />
        ) : (
          <>
          <div className="mb-3 flex items-end gap-2 md:hidden">
            <div className="min-w-0 flex-1">
              <label htmlFor="employee-directory-sort" className={labelClass}>
                Sort by
              </label>
              <select
                id="employee-directory-sort"
                value={sort}
                onChange={(event) => {
                  const key = event.target.value as SortKey;
                  url.setValues({ sort: key === "name" ? null : key, dir: key === "name" ? null : "desc", page: null });
                }}
                className={fieldClass}
              >
                {SORT_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {SORT_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => url.setValues({ dir: descending ? null : "desc", page: null })}
              aria-label={descending ? "Sorted descending, switch to ascending" : "Sorted ascending, switch to descending"}
              className={`${buttonClass} h-9 w-9 shrink-0 px-0 touch:h-11 touch:w-11`}
            >
              {descending ? <ArrowDown aria-hidden="true" className="h-4 w-4" /> : <ArrowUp aria-hidden="true" className="h-4 w-4" />}
            </button>
          </div>

          <ul aria-label="Employee directory" className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline md:hidden">
            {visible.map((row) => (
              <li key={row.key} className="relative transition-colors hover:bg-canvas">
                <div className="flex flex-col gap-3 px-3 py-3">
                  <div className="flex items-start gap-3">
                    <Avatar name={row.name} />
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => onOpen(row.key)}
                        title={`Open ${row.name}`}
                        className="block max-w-full break-words text-left font-medium text-ink after:absolute after:inset-0 after:content-['']"
                      >
                        {row.name}
                      </button>
                      <p className="flex flex-wrap items-center gap-1.5 text-xs tabular-nums text-muted">
                        {row.code}
                        {!row.hr_match && <HrMatchFlag />}
                      </p>
                    </div>
                    {row.status ? (
                      <StatusBadge status={row.status as AvailabilityStatus} />
                    ) : (
                      <span className="text-muted" title={`No Project Track record in ${data.month_label}`}>
                        {EM_DASH}
                      </span>
                    )}
                  </div>
                  <AllocationCell row={row} />
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                    <MetaField label="Available from" value={<AvailableFromCell row={row} currentMonth={data.month} />} />
                    <MetaField label="Projects" value={row.projects === null ? EM_DASH : row.projects} />
                    <MetaField label="Grade" value={text(row.grade)} />
                    <MetaField label="Location" value={text(row.location)} />
                    <MetaField label="Capability" value={text(row.capability)} className="col-span-2" />
                  </dl>
                </div>
              </li>
            ))}
          </ul>

          <TableFrame
            nested
            className="hidden md:block"
            tabIndex={0}
            role="region"
            aria-label="Employee directory"
          >
            <table className={`${tableClassInteractive} min-w-[1000px]`}>
              <thead>
                <tr>
                  <SortHeader
                    label="Employee"
                    sortKey="name"
                    active={sort === "name"}
                    descending={descending}
                    className={tableStickyColClass}
                    onSort={onSort}
                  />
                  <th scope="col" className={tableHeadClass}>
                    Grade
                  </th>
                  <th scope="col" className={tableHeadClass}>
                    Capability
                  </th>
                  <th scope="col" className={tableHeadClass}>
                    Location
                  </th>
                  <th scope="col" className={tableHeadClass}>
                    Status in {data.month_label}
                  </th>
                  <SortHeader label="Allocation" sortKey="utilisation" active={sort === "utilisation"} descending={descending} onSort={onSort} />
                  <SortHeader
                    label="Projects"
                    sortKey="projects"
                    active={sort === "projects"}
                    descending={descending}
                    align="right"
                    onSort={onSort}
                  />
                  <SortHeader label="Available from" sortKey="available" active={sort === "available"} descending={descending} onSort={onSort} />
                  <th scope="col" className={`${tableHeadClass} w-10`}>
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.key} className="group text-ink-soft" onClick={() => onOpen(row.key)}>
                    <th scope="row" className={`${tableStickyColClass} text-left font-normal`}>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpen(row.key);
                        }}
                        className="flex w-full min-w-56 items-center gap-3 rounded text-left"
                      >
                        <Avatar name={row.name} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-ink transition-colors group-hover:text-primary" title={row.name}>
                            {row.name}
                          </span>
                          <span className={`flex items-center gap-1.5 ${tableBodyId}`}>
                            {row.code}
                            {!row.hr_match && <HrMatchFlag />}
                          </span>
                        </span>
                      </button>
                    </th>
                    <td className="whitespace-nowrap">
                      <TableText>{text(row.grade)}</TableText>
                    </td>
                    <td>
                      <TableText title={text(row.capability)}>{text(row.capability)}</TableText>
                    </td>
                    <td className="whitespace-nowrap">
                      <TableText>{text(row.location)}</TableText>
                    </td>
                    <td>
                      {row.status ? (
                        <StatusBadge status={row.status as AvailabilityStatus} />
                      ) : (
                        <TableEmpty title={`No Project Track record in ${data.month_label}`} />
                      )}
                    </td>
                    <td>
                      <AllocationCell row={row} />
                    </td>
                    <td className="text-right">
                      {row.projects === null ? (
                        <TableEmpty title="Project count unavailable" />
                      ) : (
                        <TableNumeric strong className="inline-block text-right">
                          {row.projects}
                        </TableNumeric>
                      )}
                    </td>
                    <td>
                      <AvailableFromCell row={row} currentMonth={data.month} />
                    </td>
                    <td className="w-12 text-right">
                      <span className={`ml-auto ${tableRowActionClass}`}>
                        <ChevronRight aria-hidden="true" className={rowChevronClass} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableFrame>
          </>
        )}

        <Pagination
          page={current}
          pages={pages}
          total={filtered.length}
          pageSize={PAGE_SIZE}
          onChange={(next) => url.setValues({ page: next > 1 ? String(next) : null })}
        />
      </Card>
      </DirectorySummary>
    </>
  );
}
