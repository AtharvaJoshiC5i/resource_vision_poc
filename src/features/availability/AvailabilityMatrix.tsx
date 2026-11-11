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
  TableFrame,
} from "../../components/ui/primitives";
import {
  tableClassMatrix,
  tableStickyColClass,
} from "../../components/ui/tableClasses";
import { EM_DASH, hours } from "../../lib/format";
import { NO_RECORD_FILTER, STATUS_ORDER, STATUS_STYLE } from "../../lib/status";

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
  "[&_tbody_th.rv-table-sticky-col]:text-left [&_tbody_th.rv-table-sticky-col]:align-top [&_tbody_th.rv-table-sticky-col]:py-2.5",
].join(" ");

function employeeInitials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return ((parts[0]![0] ?? "") + (parts[parts.length - 1]![0] ?? "")).toUpperCase();
}

function MatrixEmployeeIdentity({ row }: { row: MatrixRow }) {
  return (
    <div className="flex min-w-0 max-w-[14rem] items-start gap-2.5 lg:max-w-[16rem]">
      <span
        aria-hidden="true"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-canvas text-[11px] font-medium leading-none text-purple-indigo ring-1 ring-inset ring-hairline"
      >
        {employeeInitials(row.name)}
      </span>
      <div className="min-w-0 flex-1">
        <Link
          to={`/employee?emp=${encodeURIComponent(row.key)}`}
          title={`Open ${row.name} in Employee 360`}
          className="block truncate text-sm font-medium text-ink transition-colors hover:text-primary"
        >
          {row.name}
        </Link>
        <div className="mt-1 flex flex-col items-start gap-1">
          <span className="text-xs font-medium tabular-nums text-muted">{row.code}</span>
          {!row.hr_match ? <HrMatchFlag /> : null}
        </div>
      </div>
    </div>
  );
}

function CellView({ cell, monthLabel }: { cell: MatrixCell; monthLabel: string }) {
  if (cell.state === "blank") {
    return <span aria-label={`${monthLabel}: no Project Track data for this month`} />;
  }
  if (cell.state === "none") {
    return (
      <span className="text-border" title="No Project Track record (not zero, not available)" aria-label={`${monthLabel}: no record`}>
        {EM_DASH}
      </span>
    );
  }
  const style = STATUS_STYLE[cell.status];
  const detail =
    cell.remaining_hours !== null ? `${hours(cell.remaining_hours)} h remaining` : cell.reason;
  const showRemaining =
    STATUSES_WITH_REMAINING_HOURS.includes(cell.status) && cell.remaining_hours !== null;
  return (
    <span
      className="rv-chip h-7 min-w-14 justify-center gap-1 px-1.5 tabular-nums"
      style={{ backgroundColor: style.bg, color: style.fg }}
      title={`${cell.status}: ${detail}`}
      aria-label={`${monthLabel}: ${cell.status}, ${detail}`}
    >
      <span aria-hidden={showRemaining ? undefined : true}>{style.letter}</span>
      {showRemaining ? <span className="text-xs">{hours(cell.remaining_hours)}</span> : null}
    </span>
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
            ? "border-primary bg-surface text-ink shadow-(--shadow-card) ring-1 ring-primary"
            : `border-transparent hover:border-hairline hover:bg-surface hover:shadow-(--shadow-card) ${
                anyActive ? "opacity-60 hover:opacity-100" : ""
              } ${muted ? "text-muted hover:text-ink-soft" : "text-ink-soft"}`
        }`}
      >
        {content}
      </button>
    );
  };

  return (
    <div className="rv-inset-panel">
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
                {EM_DASH}
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
            <button type="button" onClick={onClear} className="h-8 touch:h-10 rounded-lg px-2 text-xs font-medium text-primary hover:underline">
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
      className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-surface shadow-(--shadow-card) ring-1 ring-inset ring-ink/[0.03]"
    >
      {matrix.rows.map((row) => (
        <li key={row.key} className="flex items-start justify-between gap-3 px-3 py-3">
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
      <div className="mb-3 flex items-end gap-2 md:hidden">
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

export function AvailabilityMatrixTable({ matrix }: { matrix: AvailabilityMatrix }) {
  return (
    <TableFrame
      className="max-h-[min(560px,70dvh)]"
      tabIndex={0}
      role="region"
      aria-label="Employee allocation matrix"
    >
      <table className={MATRIX_TABLE_CLASS}>
        <thead>
          <tr>
            <th scope="col" className={`${tableStickyColClass} min-w-[12.5rem] text-left lg:min-w-[15rem]`}>
              Employee
            </th>
            {matrix.months.map((month) => (
              <th
                key={month.key}
                scope="col"
                className="min-w-[4.5rem]"
              >
                {month.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((row) => (
            <tr key={row.key} className="group">
              <th scope="row" className={tableStickyColClass}>
                <MatrixEmployeeIdentity row={row} />
              </th>
              {row.cells.map((cell, index) => (
                <td key={cell.month}>
                  <CellView cell={cell} monthLabel={matrix.months[index].label} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </TableFrame>
  );
}
