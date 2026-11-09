import { useId, useState } from "react";
import { Link } from "react-router-dom";

import type { AvailabilityMatrix, AvailabilityStatus, MatrixCell } from "../../api/types";
import {
  FlagBadge,
  StatusBadge,
  StatusChip,
  buttonClass,
  fieldClass,
  labelClass,
  tableHeadClass,
} from "../../components/ui/primitives";
import { EM_DASH, hours } from "../../lib/format";
import { STATUS_ORDER, STATUS_STYLE } from "../../lib/status";

const STATUSES_WITH_REMAINING_HOURS: AvailabilityStatus[] = [
  "Partially Available",
  "Fully Committed",
  "Over-allocated",
];

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
      className="inline-flex h-7 w-14 items-center justify-center gap-1 rounded-md text-xs font-semibold tabular-nums"
      style={{ backgroundColor: style.bg, color: style.fg }}
      title={`${cell.status}: ${detail}`}
      aria-label={`${monthLabel}: ${cell.status}, ${detail}`}
    >
      <span aria-hidden={showRemaining ? undefined : true}>{style.letter}</span>
      {showRemaining ? <span className="text-xs font-medium">{hours(cell.remaining_hours)}</span> : null}
    </span>
  );
}

export function MatrixLegend() {
  return (
    <ul aria-label="Legend" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-soft">
      {STATUS_ORDER.map((status: AvailabilityStatus) => (
        <li key={status} className="flex items-center gap-2">
          <StatusChip status={status} />
          {status}
        </li>
      ))}
      <li className="flex items-center gap-2 text-muted">
        <span aria-hidden="true" className="inline-grid h-5 w-5 place-items-center text-border">
          {EM_DASH}
        </span>
        No record
      </li>
      <li className="flex items-center gap-2 text-muted">
        <span aria-hidden="true" className="inline-block h-5 w-5 rounded-md border border-hairline bg-surface" />
        No Project Track data
      </li>
      <li className="basis-full text-muted sm:ml-auto sm:basis-auto">Figures show hours remaining</li>
    </ul>
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
    <ul aria-label={`Allocation status in ${label}`} className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline">
      {matrix.rows.map((row) => (
        <li key={row.key} className="flex items-center justify-between gap-3 px-3 py-2.5">
          <span className="min-w-0 flex-1">
            <Link
              to={`/employee?emp=${encodeURIComponent(row.key)}`}
              className="block break-words font-medium leading-5 text-ink hover:text-primary hover:underline"
            >
              {row.name}
            </Link>
            <span className="flex flex-wrap items-center gap-1.5 text-xs tabular-nums text-muted">
              {row.code}
              {!row.hr_match && <FlagBadge>No HR match</FlagBadge>}
            </span>
          </span>
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
    <div
      className="max-h-[min(560px,70dvh)] overflow-auto overscroll-contain rounded-lg border border-hairline"
      tabIndex={0}
      role="region"
      aria-label="Employee allocation matrix"
    >
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th
              scope="col"
              className={`${tableHeadClass} sticky left-0 top-0 z-20 border-r border-r-hairline`}
            >
              Employee
            </th>
            {matrix.months.map((month) => (
              <th key={month.key} scope="col" className={`${tableHeadClass} sticky top-0 z-10 min-w-[4.5rem] text-center`}>
                {month.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((row) => (
            <tr key={row.key} className="group">
              <th
                scope="row"
                className="sticky left-0 z-10 border-b border-r border-hairline bg-surface px-3 py-2 text-left font-normal group-hover:bg-canvas group-last:border-b-0"
              >
                <span className="block w-36 min-w-0 lg:w-52">
                  <Link
                    to={`/employee?emp=${encodeURIComponent(row.key)}`}
                    title={`Open ${row.name} in Employee 360`}
                    className="block truncate font-medium leading-5 text-ink hover:text-primary hover:underline"
                  >
                    {row.name}
                  </Link>
                  <span className="flex min-w-0 items-center gap-1.5 text-xs tabular-nums text-muted">
                    <span className="truncate">{row.code}</span>
                    {!row.hr_match && <FlagBadge>No HR match</FlagBadge>}
                  </span>
                </span>
              </th>
              {row.cells.map((cell, index) => (
                <td
                  key={cell.month}
                  className="border-b border-hairline px-1.5 py-1.5 text-center group-hover:bg-canvas group-last:border-b-0"
                >
                  <CellView cell={cell} monthLabel={matrix.months[index].label} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
