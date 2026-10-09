import { Calculator, CalendarClock, TriangleAlert } from "lucide-react";

import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";

export function AvailabilityFormula() {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50">
          <Calculator className="size-5 text-blue-600" aria-hidden="true" />
        </div>

        <div>
          <h2 className="text-base font-semibold text-slate-900">
            How Availability Is Calculated
          </h2>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            Resource Vision compares standard monthly capacity with the
            utilization applicable to that employee and month.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Available Capacity
          </p>

          <div className="mt-4 text-lg font-semibold text-slate-900">
            Total Capacity
            <span className="mx-2 text-slate-400">−</span>
            Utilized Capacity
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Availability %
          </p>

          <div className="mt-4 text-lg font-semibold text-slate-900">
            Available Capacity
            <span className="mx-2 text-slate-400">÷</span>
            Total Capacity
            <span className="ml-2 text-slate-400">× 100</span>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-4">
          <div className="flex items-start gap-3">
            <CalendarClock
              className="mt-0.5 size-4.5 shrink-0 text-slate-500"
              aria-hidden="true"
            />

            <div>
              <p className="text-sm font-semibold text-slate-800">
                Total Capacity
              </p>

              <p className="mt-1 text-sm leading-6 text-slate-600">
                For this POC, monthly capacity comes from Capacity Config using
                country, location, month, working days and hours per day.
              </p>

              <p className="mt-2 text-xs text-slate-500">
                This is a configurable POC capacity assumption and requires
                business validation for production.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-4">
          <div className="flex items-start gap-3">
            <TriangleAlert
              className="mt-0.5 size-4.5 shrink-0 text-slate-500"
              aria-hidden="true"
            />

            <div>
              <p className="text-sm font-semibold text-slate-800">
                Over-allocation remains visible
              </p>

              <p className="mt-1 text-sm leading-6 text-slate-600">
                If utilized capacity exceeds total capacity, Resource Vision
                preserves negative availability instead of hiding it.
              </p>

              <p className="mt-2 text-xs font-medium text-slate-600">
                176 hrs capacity · 200 hrs utilized · -24 hrs available
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/50 p-5">
        <Badge variant="blue">Example</Badge>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <ExampleValue label="Total Capacity" value="176 hrs" />

          <ExampleValue label="Utilized Capacity" value="132 hrs" />

          <ExampleValue label="Available Capacity" value="44 hrs" />

          <ExampleValue label="Availability" value="25%" />
        </div>

        <p className="mt-4 text-xs text-slate-500">
          44 ÷ 176 × 100 = 25%. This is an illustrative example, not a current
          organizational KPI.
        </p>
      </div>
    </Card>
  );
}

function ExampleValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>

      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}
