import { CheckCircle2, CircleDot } from "lucide-react";

import { Card } from "../ui/Card";

const POC_ITEMS = [
  "Synthetic JSON datasets",
  "Frontend normalization and calculation",
  "Resource availability validation",
  "Read-only analytical experience",
];

const PRODUCTION_ITEMS = [
  "Authoritative source-system integration",
  "Validated production capacity rules",
  "Complete Project Track dataset",
  "Real Famstack actuals",
  "Real ZingHR employee master",
  "Resource workflows layered on validated availability",
];

export function PocProductionComparison() {
  return (
    <Card>
      <div>
        <h2 className="text-base font-semibold text-slate-900">
          POC Today vs Production Direction
        </h2>

        <p className="mt-1 text-sm leading-6 text-slate-500">
          The demonstration validates the resource model and experience before
          authoritative production integration.
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-5">
          <p className="text-sm font-semibold text-slate-900">POC Today</p>

          <div className="mt-4 space-y-3">
            {POC_ITEMS.map((item) => (
              <div key={item} className="flex items-start gap-2.5">
                <CheckCircle2
                  className="mt-0.5 size-4 shrink-0 text-blue-600"
                  aria-hidden="true"
                />

                <p className="text-sm text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm font-semibold text-slate-900">
            Production Direction
          </p>

          <div className="mt-4 space-y-3">
            {PRODUCTION_ITEMS.map((item) => (
              <div key={item} className="flex items-start gap-2.5">
                <CircleDot
                  className="mt-0.5 size-4 shrink-0 text-slate-500"
                  aria-hidden="true"
                />

                <p className="text-sm text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
        Production integration is intentionally described in technology-neutral
        terms. The final source connection and mapping approach will be
        established during integration.
      </p>
    </Card>
  );
}
