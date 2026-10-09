import { MapPin } from "lucide-react";

import type { ResourceEmployeeDetail } from "../../types/resourceDetail";

import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";

interface ResourceIdentityProps {
  employee: ResourceEmployeeDetail;
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function formatEmployeeDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);

  if (match === null) {
    return value;
  }

  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function ResourceIdentity({ employee }: ResourceIdentityProps) {
  return (
    <Card>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-lg font-semibold text-blue-700">
            {getInitials(employee.employeeName)}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                {employee.employeeName}
              </h1>

              <Badge
                variant={
                  employee.employmentStatus === "Active" ? "green" : "neutral"
                }
              >
                {employee.employmentStatus}
              </Badge>
            </div>

            <p className="mt-1 text-sm font-medium text-slate-500">
              {employee.employeeId}
            </p>

            <p className="mt-4 text-sm font-medium text-slate-800">
              {employee.primaryCapability}
              {" · "}
              {employee.secondaryCapability}
            </p>

            <p className="mt-1 text-sm text-slate-600">
              {employee.grade}
              {" · "}
              {employee.department}
            </p>

            <div className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
              <MapPin className="size-4" aria-hidden="true" />

              <span>
                {employee.location}, {employee.country}
              </span>
            </div>
          </div>
        </div>

        <dl className="grid shrink-0 grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <div>
            <dt className="text-xs text-slate-500">Joined</dt>

            <dd className="mt-1 font-medium text-slate-800">
              {formatEmployeeDate(employee.dateOfJoining)}
            </dd>
          </div>

          {employee.dateOfLeaving !== undefined && (
            <div>
              <dt className="text-xs text-slate-500">Leaving</dt>

              <dd className="mt-1 font-medium text-slate-800">
                {formatEmployeeDate(employee.dateOfLeaving)}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </Card>
  );
}
