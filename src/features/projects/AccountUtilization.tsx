import { useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";

import type { AccountUtilization } from "../../api/types";
import { EmptyBlock, ErrorBlock, TableSkeleton, rowChevronClass } from "../../components/ui/primitives";
import { KpiBand, KpiGroup, KpiStat } from "../../components/ui/KpiBand";
import { TableCard, TableScroll } from "../../components/ui/TableCard";
import { TableNumeric, TableText, tableRowActionClass } from "../../components/ui/tableCells";
import {
  tableClassDense,
  tableClassInteractive,
  tableHeadClass,
  tableHeadLabelClass,
  tableStickyColClass,
  tableTotalColClass,
} from "../../components/ui/tableClasses";
import { useApi } from "../../hooks/useApi";
import { EMPTY, hours, integer } from "../../lib/format";

function percent(share: number | null): string {
  if (share == null) return "–";
  const value = share * 100;
  return `${value < 1 && value > 0 ? value.toFixed(1) : Math.round(value)}%`;
}

function clientEmployeePath(client: string): string {
  return `/employee?client=${encodeURIComponent(client)}`;
}

function ShareCell({ share, total = false }: { share: number | null; total?: boolean }) {
  const pct = share != null ? Math.min(1, Math.max(0, share)) : 0;
  const label = percent(share);
  return (
    <div
      className={`rv-account-share${total ? " rv-account-share--total" : ""}`}
      aria-label={share != null ? `${label} of planned hours in this table` : undefined}
    >
      <span className="rv-account-share__value">{label}</span>
      <span className="rv-account-share__track" aria-hidden="true">
        <span className="rv-account-share__fill" style={{ width: `${pct * 100}%` }} />
      </span>
    </div>
  );
}

function PlannedHoursStat({ value, loading }: { value: number | null | undefined; loading: boolean }) {
  return (
    <div className="rv-kpi-stat">
      <dt className="rv-kpi-stat__label">
        <span className="truncate">Planned hours</span>
      </dt>
      <dd className="rv-kpi-stat__value">
        {loading ? (
          <span aria-hidden="true" className="skeleton block h-6 w-16" />
        ) : value == null ? (
          EMPTY
        ) : (
          <>
            {hours(value)}
            <span className="ml-1 text-sm font-medium text-muted">h</span>
          </>
        )}
      </dd>
    </div>
  );
}

/**
 * Planned hours per client account over the selected reporting months. Shares are of the planned
 * hours in this table. Selecting an account opens Employee 360 filtered to that client.
 */
export function AccountUtilizationCard({ months, actions }: { months: string[]; actions?: ReactNode }) {
  const navigate = useNavigate();
  const data = useApi<AccountUtilization>("/accounts/utilization", { months });
  const rows = useMemo(() => data.data?.rows ?? [], [data.data]);
  const totals = data.data?.totals;
  const loading = !data.data && !data.error;
  const projectCount = useMemo(() => rows.reduce((sum, row) => sum + row.projects, 0), [rows]);

  return (
    <TableCard
      className="rv-account-util"
      title="Utilization by account"
      titleId="accounts-utilization-heading"
      actions={actions}
      count={
        totals ? `${integer(totals.accounts)} ${totals.accounts === 1 ? "account" : "accounts"}` : undefined
      }
    >
      {data.error ? (
        <div className="p-4 sm:p-5">
          <ErrorBlock message={data.error} onRetry={data.reload} />
        </div>
      ) : loading ? (
        <div className="p-4 sm:p-5">
          <TableSkeleton rows={4} columns={5} label="Loading account utilization" />
        </div>
      ) : rows.length === 0 ? (
        <div className="p-4 sm:p-5">
          <EmptyBlock message="No planned allocations with a client in these months" />
        </div>
      ) : (
        <>
          <KpiBand label="Account utilization totals">
            <KpiGroup title="Planned effort by client" columns={3}>
              <KpiStat label="Accounts" value={totals!.accounts} />
              <KpiStat label="People" value={totals!.employees} />
              <PlannedHoursStat value={totals!.planned_hours} loading={false} />
            </KpiGroup>
          </KpiBand>

          <TableScroll className="max-h-[min(26rem,50dvh)]" label="Utilization by account">
            <table className={`${tableClassInteractive} ${tableClassDense} rv-account-util__table min-w-[34rem]`}>
              <thead>
                <tr>
                  <th scope="col" className={`${tableHeadClass} ${tableStickyColClass} min-w-[11rem] text-left`}>
                    <span className={tableHeadLabelClass}>Account</span>
                  </th>
                  <th scope="col" className={`${tableHeadClass} w-[4.75rem] text-right`}>
                    <span className={tableHeadLabelClass}>Projects</span>
                  </th>
                  <th scope="col" className={`${tableHeadClass} w-[4.75rem] text-right`}>
                    <span className={tableHeadLabelClass}>People</span>
                  </th>
                  <th scope="col" className={`${tableHeadClass} ${tableTotalColClass} w-[6.25rem] text-right`}>
                    <span className={tableHeadLabelClass}>Planned h</span>
                  </th>
                  <th scope="col" className={`${tableHeadClass} min-w-[8.5rem] text-left`}>
                    <span className={tableHeadLabelClass}>Share</span>
                  </th>
                  <th scope="col" className={`${tableHeadClass} w-12 text-right`}>
                    <span className="sr-only">Open in Employee 360</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const path = clientEmployeePath(row.client);
                  return (
                    <tr
                      key={row.client}
                      tabIndex={0}
                      onClick={() => navigate(path)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          navigate(path);
                        }
                      }}
                      className="group cursor-pointer text-ink-soft"
                    >
                      <th scope="row" className={`${tableStickyColClass} max-w-[18rem] text-left font-normal`}>
                        <TableText title={row.client} className="text-sm font-medium leading-5 text-ink transition-colors group-hover:text-primary">
                          {row.client}
                        </TableText>
                      </th>
                      <td className="text-right">
                        <TableNumeric>{integer(row.projects)}</TableNumeric>
                      </td>
                      <td className="text-right">
                        <TableNumeric>{integer(row.employees)}</TableNumeric>
                      </td>
                      <td className={`${tableTotalColClass} text-right`}>
                        <TableNumeric strong>{hours(row.planned_hours)}</TableNumeric>
                      </td>
                      <td>
                        <ShareCell share={row.share} />
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
              {totals ? (
                <tfoot>
                  <tr className="rv-table-summary-row">
                    <th scope="row" className={`${tableStickyColClass} text-left font-normal`}>
                      <span className="rv-table-summary-label">Total</span>
                      <span className="rv-table-summary-meta">
                        {integer(totals.accounts)} {totals.accounts === 1 ? "account" : "accounts"} in view
                      </span>
                    </th>
                    <td className="text-right">
                      <TableNumeric strong>{integer(projectCount)}</TableNumeric>
                    </td>
                    <td className="text-right">
                      <TableNumeric strong>{integer(totals.employees)}</TableNumeric>
                    </td>
                    <td className={`${tableTotalColClass} text-right`}>
                      <TableNumeric strong>{hours(totals.planned_hours)}</TableNumeric>
                    </td>
                    <td>
                      <ShareCell share={totals.planned_hours != null ? 1 : null} total />
                    </td>
                    <td className="w-12" aria-hidden="true" />
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </TableScroll>

        </>
      )}
    </TableCard>
  );
}