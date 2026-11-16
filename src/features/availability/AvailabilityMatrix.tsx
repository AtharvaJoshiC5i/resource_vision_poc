import { useId, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import type { AvailabilityMatrix, AvailabilityStatus, MatrixCell } from "../../api/types";
import {
  HrMatchFlag,
  StatusBadge,
  StatusChip,
  buttonClass,
  fieldClass,
  labelClass,
} from "../../components/ui/primitives";
import { TableScroll } from "../../components/ui/TableCard";
import { Tooltip } from "../../components/ui/Tooltip";
import {
  tableClassMatrix,
  tableHeadClass,
  tableHeadLabelClass,
  tableStickyColClass,
} from "../../components/ui/tableClasses";
import { EMPTY, hours } from "../../lib/format";
import { NO_RECORD_FILTER, STATUS_ORDER, STATUS_STYLE } from "../../lib/status";
import { TENURE_HINT, clientSummary } from "../../lib/tags";

const STATUSES_WITH_REMAINING_HOURS: AvailabilityStatus[] = [
  "Partially Available",
  "Fully Committed",
  "Over-allocated",
];

type MatrixRow = AvailabilityMatrix["rows"][number];

const MATRIX_TABLE_CLASS = [
  tableClassMatrix,
  "min-w-full",
  "[&_thead_th.rv-table-sticky-col]:text-left",
  "[&_tbody_th.rv-table-sticky-col]:text-left",
].join(" ");

function employeeInitials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return ((parts[0]![0] ?? "") + (parts[parts.length - 1]![0] ?? "")).toUpperCase();
}

function MatrixEmployeeIdentity({ row }: { row: MatrixRow }) {
  const badges = (
    <>
      {row.tenure === "Fresher" ? <TenureBadge /> : null}
      {!row.hr_match ? <HrMatchFlag className="max-w-full" /> : null}
    </>
  );

  return (
    <div className="rv-matrix-employee min-w-0 max-w-full overflow-hidden">
      <div className="flex min-w-0 items-start gap-2">
        <span aria-hidden="true" className="rv-avatar mt-0.5">
          {employeeInitials(row.name)}
        </span>
        <div className="min-w-0 flex-1 overflow-hidden">
          <Tooltip content={`Open ${row.name} in Employee 360`}>
            <Link
              to={`/employee?emp=${encodeURIComponent(row.key)}`}
              className="rv-matrix-employee__name block text-[13px] font-medium leading-[1.35] text-ink transition-colors hover:text-primary"
            >
              {row.name}
            </Link>
          </Tooltip>
          <p className="mt-0.5 truncate text-xs leading-4 tabular-nums text-muted" title={row.code}>
            {row.code}
          </p>
          {row.business_vertical ? (
            <Tooltip content={`Business vertical: ${row.business_vertical}`}>
              <p className="mt-0.5 truncate text-xs leading-4 text-muted">{row.business_vertical}</p>
            </Tooltip>
          ) : null}
          {row.tenure === "Fresher" || !row.hr_match ? (
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">{badges}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TenureBadge() {
  return (
    <Tooltip content={`Fresher: ${TENURE_HINT.Fresher}`}>
      <span className="shrink-0 rounded bg-primary-soft/80 px-1 text-[10px] font-medium leading-4 text-purple-indigo">
        Fresher
      </span>
    </Tooltip>
  );
}

function ClientCell({ clients }: { clients: string[] }) {
  const summary = clientSummary(clients);
  if (!summary) {
    return <span className="text-xs text-muted">{EMPTY}</span>;
  }
  return (
    <Tooltip content={summary.full}>
      <span className="block max-w-[10rem] truncate text-xs text-ink-soft">{summary.short}</span>
    </Tooltip>
  );
}

function CellView({ cell, monthLabel }: { cell: MatrixCell; monthLabel: string }) {
  if (cell.state === "blank") {
    return <span aria-label={`${monthLabel}: no Project Track data for this month`} />;
  }
  if (cell.state === "none") {
    return (
      <Tooltip content="No Project Track record (not zero, not available)">
        <span className="rv-status-tile rv-status-tile--empty" aria-label={`${monthLabel}: no record`}>
          {EMPTY}
        </span>
      </Tooltip>
    );
  }
  const style = STATUS_STYLE[cell.status];
  const detail =
    cell.remaining_hours !== null ? `${hours(cell.remaining_hours)} h remaining` : cell.reason;
  const showRemaining =
    STATUSES_WITH_REMAINING_HOURS.includes(cell.status) && cell.remaining_hours !== null;
  return (
    <Tooltip content={`${cell.status}: ${detail}`}>
      <span
        className="rv-status-tile"
        style={{ backgroundColor: style.bg, color: style.fg }}
        aria-label={`${monthLabel}: ${cell.status}, ${detail}`}
      >
      <span className="rv-status-tile__letter" aria-hidden={showRemaining ? undefined : true}>
        {style.letter}
      </span>
      {showRemaining ? <span className="rv-status-tile__value">{hours(cell.remaining_hours)}</span> : null}
      </span>
    </Tooltip>
  );
}

const legendItemBase =
  "inline-flex h-8 touch:h-10 items-center gap-2 rounded-lg border px-2 text-xs transition-[background-color,border-color,box-shadow,opacity] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/**
 * Key for the matrix. When `selected` and `onToggle` are given, each status becomes a filter toggle
 * that narrows the matrix to employees with that status in the months in view.
 */
export function MatrixLegend({
  selected,
  onToggle,
  onClear,
}: {
  selected?: string[];
  onToggle?: (value: string) => void;
  onClear?: () => void;
}) {
  const interactive = Boolean(onToggle);
  const anyActive = (selected?.length ?? 0) > 0;

  const item = (value: string, content: ReactNode, muted = false) => {
    if (!interactive) {
      return <span className={`flex items-center gap-2 ${muted ? "text-muted" : ""}`}>{content}</span>;
    }
    const active = selected?.includes(value) ?? false;
    return (
      <button
        type="button"
        aria-pressed={active}
        onClick={() => onToggle?.(value)}
        className={`${legendItemBase} ${
          active
            ? "border-primary/45 bg-primary-soft font-medium text-ink shadow-(--shadow-control)"
            : `border-transparent hover:border-card-border hover:bg-surface hover:shadow-(--shadow-control) ${
                anyActive ? "opacity-60 hover:opacity-100" : ""
              } ${muted ? "text-muted hover:text-ink-soft" : "text-ink-soft"}`
        }`}
      >
        {content}
      </button>
    );
  };

  return (
    <div>
      <ul aria-label="Legend" className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5 text-xs text-ink-soft">
        {STATUS_ORDER.map((status: AvailabilityStatus) => (
          <li key={status}>
            {item(
              status,
              <>
                <StatusChip status={status} />
                {status}
              </>,
            )}
          </li>
        ))}
        <li>
          {item(
            NO_RECORD_FILTER,
            <>
              <span aria-hidden="true" className="inline-grid h-5 w-5 place-items-center text-border">
                {EMPTY}
              </span>
              No record
            </>,
            true,
          )}
        </li>
        <li className={interactive ? "px-2" : ""}>
          <span className="flex items-center gap-2 text-muted">
            <span aria-hidden="true" className="inline-block h-5 w-5 rounded-md border border-hairline bg-surface" />
            No Project Track data
          </span>
        </li>
        {interactive && anyActive && onClear ? (
          <li>
            <button type="button" onClick={onClear} className="h-8 touch:h-10 rounded-lg px-2.5 text-xs font-medium text-primary transition-colors hover:bg-primary-soft">
              Clear status filter
            </button>
          </li>
        ) : null}
        <li className="basis-full px-2 text-muted sm:ml-auto sm:basis-auto">
          {interactive ? "Select a status to filter. Figures show hours remaining" : "Figures show hours remaining"}
        </li>
      </ul>
    </div>
  );
}

/** Phone layout: one month at a time, one row per employee, with the detail that the matrix shows on hover. */
function MonthStatus({ cell }: { cell: MatrixCell | undefined }) {
  if (!cell || cell.state === "blank") {
    return <span className="shrink-0 text-xs text-muted">No Project Track data</span>;
  }
  if (cell.state === "none") {
    return <span className="shrink-0 text-xs text-muted">No record</span>;
  }
  const detail = cell.remaining_hours !== null ? `${hours(cell.remaining_hours)} h remaining` : cell.reason;
  return (
    <span className="flex max-w-[55%] shrink-0 flex-col items-end gap-0.5 text-right">
      <StatusBadge status={cell.status} />
      <span className="break-words text-xs tabular-nums text-muted">{detail}</span>
    </span>
  );
}

function MatrixMonthList({ matrix, month }: { matrix: AvailabilityMatrix; month: number }) {
  const index = matrix.months.findIndex((m) => m.key === month);
  const label = matrix.months[index]?.label ?? "";
  return (
    <ul
      aria-label={`Allocation status in ${label}`}
      className="divide-y divide-hairline"
    >
      {matrix.rows.map((row) => (
        <li key={row.key} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <MatrixEmployeeIdentity row={row} />
          </div>
          <MonthStatus cell={row.cells[index]} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Wide screens show the full matrix. Phones show one month at a time, with the full matrix one tap away.
 */
export function AvailabilityMatrixView({ matrix }: { matrix: AvailabilityMatrix }) {
  const selectId = useId();
  const [picked, setPicked] = useState<number | null>(null);
  const [showFull, setShowFull] = useState(false);

  const firstWithData = matrix.months.find((_month, i) => matrix.rows.some((r) => r.cells[i]?.state === "status"));
  const month =
    picked !== null && matrix.months.some((m) => m.key === picked)
      ? picked
      : (firstWithData?.key ?? matrix.months[0]?.key ?? 0);

  return (
    <>
      <div className="flex items-end gap-2 border-b border-hairline px-4 py-3 md:hidden">
        {!showFull && (
          <div className="min-w-0 flex-1">
            <label htmlFor={selectId} className={labelClass}>
              Month
            </label>
            <select
              id={selectId}
              value={String(month)}
              onChange={(event) => setPicked(Number(event.target.value))}
              className={fieldClass}
            >
              {matrix.months.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <button
          type="button"
          aria-pressed={showFull}
          onClick={() => setShowFull((value) => !value)}
          className={`${buttonClass} h-9 touch:h-11 ${showFull ? "w-full" : "shrink-0"}`}
        >
          {showFull ? "Back to month view" : "Full matrix"}
        </button>
      </div>

      <div className={showFull ? "hidden" : "md:hidden"}>
        <MatrixMonthList matrix={matrix} month={month} />
      </div>
      <div className={showFull ? "" : "hidden md:block"}>
        <AvailabilityMatrixTable matrix={matrix} />
      </div>
    </>
  );
}

function currentMonthKey() {
  const now = new Date();
  return now.getFullYear() * 100 + now.getMonth() + 1;
}

export function AvailabilityMatrixTable({ matrix }: { matrix: AvailabilityMatrix }) {
  const current = currentMonthKey();
  return (
    <TableScroll className="max-h-[min(600px,72dvh)]" label="Employee allocation matrix">
      <table className={MATRIX_TABLE_CLASS}>
        <thead>
          <tr>
            <th
              scope="col"
              className={`${tableHeadClass} ${tableStickyColClass} rv-table-employee-col min-w-[12.5rem] text-left lg:min-w-[14.5rem]`}
            >
              <span className={tableHeadLabelClass}>Employee</span>
            </th>
            <th scope="col" className={`${tableHeadClass} min-w-[8rem] text-left`}>
              <Tooltip content="Clients this employee is allocated to in the current month">
                <span className={tableHeadLabelClass}>Current client</span>
              </Tooltip>
            </th>
            {matrix.months.map((month) => {
              const [monthName, yearPart] = month.label.split(" ");
              const hint = month.key === current ? `${month.label} (current month)` : month.label;
              return (
                <th
                  key={month.key}
                  scope="col"
                  aria-current={month.key === current ? "date" : undefined}
                  className={`${tableHeadClass} min-w-[4.5rem] text-center ${month.key === current ? "rv-table-col--current" : ""}`}
                >
                  <Tooltip content={hint}>
                    <span className="rv-table-head-stack">
                      <span className="rv-table-head-stack__primary">{monthName}</span>
                      {yearPart ? <span className="rv-table-head-stack__secondary">{yearPart}</span> : null}
                    </span>
                  </Tooltip>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((row) => (
            <tr key={row.key} className="group">
              <th scope="row" className={`${tableStickyColClass} rv-table-employee-col`}>
                <MatrixEmployeeIdentity row={row} />
              </th>
              <td className="text-left">
                <ClientCell clients={row.clients} />
              </td>
              {row.cells.map((cell, index) => (
                <td key={cell.month} className={cell.month === current ? "rv-table-col--current" : undefined}>
                  <CellView cell={cell} monthLabel={matrix.months[index].label} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  );
}
