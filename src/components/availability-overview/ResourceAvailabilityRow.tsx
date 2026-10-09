import { ArrowUpRight } from "lucide-react";

import { Link } from "react-router-dom";

import type { ResourceAvailabilityMatrixRow } from "../../types/resourceAvailabilityMatrix";

import { getCurrentMonthKey } from "../../services/monthService";

import { formatMonth } from "../../utils/formatters";

import { AvailabilityMonthCell } from "./AvailabilityMonthCell";

interface ResourceAvailabilityRowProps {
  row: ResourceAvailabilityMatrixRow;

  monthKeys: string[];
}

function formatAllocatedUntil(value: string | undefined): string {
  if (value === undefined || value.trim() === "") {
    return "—";
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);

  if (match === null) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(
    new Date(
      Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
    ),
  );
}

function getProjectSummary(row: ResourceAvailabilityMatrixRow): {
  primary: string;
  secondary?: string;
  title: string;
} {
  if (row.projects.length === 0) {
    return {
      primary: "No active projects",

      title: "No project commitments in the visible planning horizon.",
    };
  }

  const names = row.projects.map((project) => project.projectName);

  const primary = names.slice(0, 2).join(", ");

  const remaining = names.length - 2;

  return {
    primary,

    secondary: remaining > 0 ? `+${remaining} more` : undefined,

    title: row.projects
      .map((project) => {
        const end =
          project.projectEndDate !== undefined
            ? ` → ${project.projectEndDate}`
            : "";

        return `${project.projectName}${end}`;
      })
      .join("\n"),
  };
}

function getForwardSignal(row: ResourceAvailabilityMatrixRow): string | null {
  const firstMonth = row.months[0]?.monthKey;

  if (
    row.firstFullAvailabilityMonth !== undefined &&
    row.firstFullAvailabilityMonth !== firstMonth
  ) {
    return `Full capacity ${formatMonth(row.firstFullAvailabilityMonth)}`;
  }

  if (
    row.firstCapacityGainMonth !== undefined &&
    row.firstCapacityGainMonth !== firstMonth
  ) {
    return `Capacity increases ${formatMonth(row.firstCapacityGainMonth)}`;
  }

  return null;
}

export function ResourceAvailabilityRow({
  row,
  monthKeys,
}: ResourceAvailabilityRowProps) {
  const projects = getProjectSummary(row);

  const forwardSignal = getForwardSignal(row);
  const currentMonth = getCurrentMonthKey();

  return (
    <tr className="group transition-colors hover:bg-slate-50/80">
      {/* Resource */}

      <th
        scope="row"
        className="sticky left-0 z-10 w-[230px] min-w-[230px] border-b border-r border-slate-100 bg-white px-4 py-3 text-left align-middle group-hover:bg-slate-50"
      >
        <Link
          to={`/resources/${encodeURIComponent(row.employeeId)}`}
          className="group/link block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-semibold text-slate-900 group-hover/link:text-blue-700">
              {row.employeeName}
            </span>

            <ArrowUpRight
              className="size-3.5 shrink-0 text-slate-300 transition-colors group-hover/link:text-blue-600"
              aria-hidden="true"
            />
          </div>

          <p className="mt-1 truncate text-[10px] font-normal leading-none text-slate-400">
            {row.employeeId}
            {" · "}
            {row.location}
          </p>

          {forwardSignal !== null && (
            <p className="mt-2 truncate text-[10px] font-medium leading-none text-blue-600">
              {forwardSignal}
            </p>
          )}
        </Link>
      </th>

      {/* Projects */}

      <td className="w-[255px] min-w-[255px] border-b border-slate-100 px-4 py-3 align-middle">
        <div title={projects.title} className="max-w-[220px]">
          <p
            className={`truncate text-xs font-medium ${
              row.projects.length === 0 ? "text-slate-400" : "text-slate-700"
            }`}
          >
            {projects.primary}
          </p>

          {projects.secondary !== undefined && (
            <p className="mt-1 text-[10px] font-medium leading-none text-slate-400">
              {projects.secondary}
            </p>
          )}
        </div>
      </td>

      {/* Allocated Until */}

      <td className="w-[120px] min-w-[120px] border-b border-r border-slate-100 px-4 py-3 text-left align-middle">
        <span className="whitespace-nowrap text-xs font-medium text-slate-600">
          {formatAllocatedUntil(row.allocatedUntil)}
        </span>
      </td>

      {/* Month availability */}

      {monthKeys.map((monthKey) => {
        const month = row.months.find(
          (candidate) => candidate.monthKey === monthKey,
        );

        return (
          <td
            key={monthKey}
            className={`w-[112px] min-w-[112px] border-b border-slate-100 px-2 py-2.5 align-middle ${
              monthKey === currentMonth
                ? "bg-blue-50/70"
                : ""
            }`}
          >
            <AvailabilityMonthCell
              monthKey={monthKey}
              availability={month?.availability ?? null}
            />
          </td>
        );
      })}
    </tr>
  );
}
