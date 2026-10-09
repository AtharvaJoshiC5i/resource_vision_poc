import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function SourceTimeline() {
  return (
    <Card>
      <div>
        <h2 className="text-base font-semibold text-slate-900">
          Actual vs Planned Utilization
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          The POC uses a fixed September transition between historical actuals
          and the current/future planning period.
        </p>
      </div>

      <div className="mt-6 overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-12">
            {MONTHS.map((month, index) => {
              const planned = index >= 8;

              return (
                <div
                  key={month}
                  className={`border-b px-2 py-3 text-center ${
                    index === 8 ? "border-l-2 border-l-slate-300" : ""
                  } ${
                    planned
                      ? "border-b-blue-200 bg-blue-50/40"
                      : "border-b-slate-200 bg-slate-50"
                  }`}
                >
                  <p className="text-xs font-semibold text-slate-700">
                    {month}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-12">
            <div className="col-span-8 px-4 py-5 text-center">
              <Badge variant="neutral">Actual · Famstack</Badge>

              <p className="mt-2 text-sm font-medium text-slate-800">
                Historical Actual
              </p>

              <p className="mt-1 text-xs text-slate-500">Jan–Aug 2026</p>
            </div>

            <div className="col-span-4 border-l-2 border-l-slate-300 bg-blue-50/20 px-4 py-5 text-center">
              <Badge variant="blue">Planned · Project Track</Badge>

              <p className="mt-2 text-sm font-medium text-slate-800">
                Current / Future Plan
              </p>

              <p className="mt-1 text-xs text-slate-500">Sep–Dec 2026</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 border-t border-slate-100 pt-4 text-sm leading-6 text-slate-600">
        Historical months use actual employee effort from Famstack. The current
        and future planning period uses planned project effort from Project
        Track.
      </div>
    </Card>
  );
}
