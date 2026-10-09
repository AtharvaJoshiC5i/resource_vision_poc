import { ArrowUpRight } from "lucide-react";

import { Link } from "react-router-dom";

import type { CapabilityAvailabilityItem } from "../../services/overviewService";

import { formatHours, formatPercentage } from "../../utils/formatters";

import { Card } from "../ui/Card";

interface CapabilityAvailabilityListProps {
  data: CapabilityAvailabilityItem[];
}

export function CapabilityAvailabilityList({
  data,
}: CapabilityAvailabilityListProps) {
  return (
    <Card>
      <div>
        <h2 className="text-base font-semibold text-slate-900">
          Availability by Primary Capability
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Available capacity for the selected month across primary capability
          groups.
        </p>

        <p className="mt-2 text-xs text-slate-400">Lowest availability first</p>
      </div>

      <div className="mt-5 divide-y divide-slate-100">
        {data.map((item) => {
          const query = new URLSearchParams({
            primaryCapability: item.primaryCapability,
          });

          const negative = item.availableCapacity < 0;

          return (
            <Link
              key={item.primaryCapability}
              to={`/availability?${query.toString()}`}
              className="group block py-4 outline-none first:pt-0 last:pb-0 focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-medium text-slate-900 group-hover:text-blue-700">
                      {item.primaryCapability}
                    </p>

                    <ArrowUpRight
                      className="size-3.5 shrink-0 text-slate-400 group-hover:text-blue-600"
                      aria-hidden="true"
                    />
                  </div>

                  <p className="mt-1 text-xs text-slate-500">
                    {item.resourceCount}{" "}
                    {item.resourceCount === 1 ? "resource" : "resources"}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p
                    className={`text-sm font-semibold ${
                      negative ? "text-red-700" : "text-slate-900"
                    }`}
                  >
                    {formatPercentage(item.availabilityPercentage)}
                  </p>

                  <p
                    className={`mt-1 text-xs ${
                      negative ? "text-red-600" : "text-slate-500"
                    }`}
                  >
                    {formatHours(item.availableCapacity)} available
                  </p>
                </div>
              </div>

              <div className="mt-3">
                <progress
                  value={Math.min(
                    100,
                    Math.max(0, item.availabilityPercentage),
                  )}
                  max={100}
                  aria-label={`${item.primaryCapability}: ${formatPercentage(
                    item.availabilityPercentage,
                  )} available`}
                  className="h-1.5 w-full accent-blue-600"
                />
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
