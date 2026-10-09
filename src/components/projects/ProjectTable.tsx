import type { ReactNode } from "react";

import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

import type { ProjectListRow } from "../../types/projectAvailability";

import { formatHours, formatMonth } from "../../utils/formatters";

import { ProjectPlanningPriority } from "./ProjectPlanningPriority";
import { Card } from "../ui/Card";

interface ProjectTableProps {
  rows: ProjectListRow[];
  focusMonth: string;
  today?: Date;
  planningHorizonEnd?: string;
}

function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);

  if (!match) {
    return value || "—";
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function ProjectTable({
  rows,
  focusMonth,
  today = new Date(),
  planningHorizonEnd,
}: ProjectTableProps) {
  return (
    <Card padding={false}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1060px] border-collapse text-sm">
          <thead className="bg-slate-50">
            <tr>
              <Header>Project</Header>
              <Header>Proposal</Header>
              <Header>Status</Header>
              <Header>Start</Header>
              <Header>End</Header>
              <Header>Planning Priority</Header>
              <Header align="right">Resources</Header>
              <Header align="right">{formatMonth(focusMonth)} Effort</Header>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((row) => (
              <tr
                key={row.projectId}
                className="transition-colors hover:bg-slate-50/80"
              >
                <td className="px-5 py-3.5 align-middle">
                  <Link
                    to={`/projects/${encodeURIComponent(row.projectId)}`}
                    className="group inline-flex items-center gap-1.5 rounded outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  >
                    <span className="text-xs font-semibold text-slate-900 group-hover:text-blue-700">
                      {row.projectName}
                    </span>

                    <ArrowUpRight
                      className="size-3.5 shrink-0 text-slate-300 group-hover:text-blue-600"
                      aria-hidden="true"
                    />
                  </Link>
                </td>

                <td className="px-4 py-3.5 align-middle text-xs text-slate-500">
                  {row.proposalNumber || "—"}
                </td>

                <td className="px-4 py-3.5 align-middle">
                  <span className="text-xs font-medium text-slate-600">
                    {row.projectStatus}
                  </span>
                </td>

                <td className="whitespace-nowrap px-4 py-3.5 align-middle text-xs text-slate-600">
                  {formatDate(row.startDate)}
                </td>

                <td className="whitespace-nowrap px-4 py-3.5 align-middle text-xs text-slate-600">
                  {formatDate(row.endDate)}
                </td>

                <td className="px-4 py-3.5 align-middle">
                  <ProjectPlanningPriority
                    startDate={row.startDate}
                    planningHorizonEnd={planningHorizonEnd}
                    today={today}
                  />
                </td>

                <td className="px-4 py-3.5 text-right align-middle text-xs font-medium tabular-nums text-slate-700">
                  {row.resourceCount.toLocaleString("en-US")}
                </td>

                <td className="px-5 py-3.5 text-right align-middle text-xs font-semibold tabular-nums text-slate-900">
                  {formatHours(row.focusMonthEffort)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {rows.length === 0 && (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-medium text-slate-700">
              No projects to display
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Adjust the project filters or planning horizon.
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-5 py-3">
        <p className="text-[11px] text-slate-500">
          Planning priority is based on project start dates, independently of
          project lifecycle status.
        </p>

        <span className="text-[11px] font-medium tabular-nums text-slate-500">
          {rows.length} {rows.length === 1 ? "project" : "projects"}
        </span>
      </div>
    </Card>
  );
}

function Header({
  children,
  align = "left",
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={`border-b border-slate-200 px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500 first:px-5 last:px-5 ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}
