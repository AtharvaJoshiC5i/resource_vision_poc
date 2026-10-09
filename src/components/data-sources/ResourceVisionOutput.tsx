import {
  ArrowUpRight,
  ChartNoAxesCombined,
  LayoutDashboard,
  Users,
} from "lucide-react";

import { Link } from "react-router-dom";

import { Card } from "../ui/Card";

const DIMENSIONS = [
  "Primary Capability",
  "Secondary Capability",
  "Department",
  "Grade",
  "Country",
  "Location",
  "Employee",
  "Month",
];

const MEASURES = [
  "Total Capacity",
  "Utilized Capacity",
  "Available Capacity",
  "Availability %",
  "Unassigned Demand",
];

const LINKS = [
  {
    label: "View Overview",
    to: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Explore Availability",
    to: "/availability",
    icon: ChartNoAxesCombined,
  },
  {
    label: "View Resources",
    to: "/resources",
    icon: Users,
  },
];

export function ResourceVisionOutput() {
  return (
    <Card>
      <div>
        <h2 className="text-base font-semibold text-slate-900">
          Resource Vision Output
        </h2>

        <p className="mt-1 text-sm leading-6 text-slate-500">
          The unified monthly model powers the organizational, capability and
          employee-level views already available in the POC.
        </p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Dimensions
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {DIMENSIONS.map((dimension) => (
              <span
                key={dimension}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700"
              >
                {dimension}
              </span>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Measures
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {MEASURES.map((measure) => (
              <span
                key={measure}
                className="rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700"
              >
                {measure}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-3">
        {LINKS.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.to}
              to={item.to}
              className="group flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 outline-none hover:border-blue-200 hover:bg-blue-50/50 focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  className="size-4 text-slate-400 group-hover:text-blue-600"
                  aria-hidden="true"
                />

                <span className="text-sm font-medium text-slate-700 group-hover:text-blue-700">
                  {item.label}
                </span>
              </div>

              <ArrowUpRight
                className="size-4 text-slate-400 group-hover:text-blue-600"
                aria-hidden="true"
              />
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
