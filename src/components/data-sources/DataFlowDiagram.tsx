import {
  ArrowDown,
  ArrowRight,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  Gauge,
  History,
  Users,
} from "lucide-react";

import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";

interface FlowSourceProps {
  title: string;
  role: string;
  icon: typeof Users;
}

function FlowSource({ title, role, icon: Icon }: FlowSourceProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-50">
          <Icon className="size-4.5 text-slate-500" aria-hidden="true" />
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>

          <p className="mt-0.5 text-xs text-slate-500">{role}</p>
        </div>
      </div>
    </div>
  );
}

export function DataFlowDiagram() {
  return (
    <Card>
      <div>
        <h2 className="text-base font-semibold text-slate-900">
          Resource Vision Data Flow
        </h2>

        <p className="mt-1 text-sm leading-6 text-slate-500">
          Employee identity, actual effort and planned effort are combined into
          one monthly resource view.
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.15fr)_auto_minmax(0,0.8fr)] lg:items-center">
        <div className="space-y-3">
          <FlowSource title="ZingHR" role="Employee Master" icon={Users} />

          <FlowSource
            title="Famstack"
            role="Historical Actuals"
            icon={History}
          />

          <FlowSource
            title="Project Track"
            role="Current / Future Plan"
            icon={BriefcaseBusiness}
          />
        </div>

        <div className="hidden justify-center lg:flex">
          <ArrowRight className="size-5 text-slate-400" aria-hidden="true" />
        </div>

        <div className="flex justify-center lg:hidden">
          <ArrowDown className="size-5 text-slate-400" aria-hidden="true" />
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-600">
              <ChartNoAxesCombined
                className="size-5 text-white"
                aria-hidden="true"
              />
            </div>

            <div>
              <Badge variant="blue">Resource Vision</Badge>

              <h3 className="mt-3 text-lg font-semibold text-slate-900">
                Unified Resource Model
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                One employee-month view combining resource dimensions, monthly
                capacity and applicable utilization.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-blue-100 bg-white p-3">
            <p className="text-xs font-medium text-slate-500">
              Employee relationship
            </p>

            <p className="mt-1 text-sm text-slate-700">
              Employee ID links employee information across ZingHR, Famstack and
              employee-tagged Project Track records.
            </p>
          </div>
        </div>

        <div className="hidden justify-center lg:flex">
          <ArrowRight className="size-5 text-slate-400" aria-hidden="true" />
        </div>

        <div className="flex justify-center lg:hidden">
          <ArrowDown className="size-5 text-slate-400" aria-hidden="true" />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100">
            <Gauge className="size-5 text-slate-600" aria-hidden="true" />
          </div>

          <h3 className="mt-4 text-base font-semibold text-slate-900">
            Availability Engine
          </h3>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Converts monthly capacity and utilization into available capacity
            and availability percentage.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 border-t border-slate-100 pt-5 lg:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-800">
            Employee-level planning
          </p>

          <p className="mt-1 text-sm leading-6 text-slate-600">
            Where Project Track contains a named employee, Employee ID links
            that planned effort to the resource.
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-800">
            Unassigned demand
          </p>

          <p className="mt-1 text-sm leading-6 text-slate-600">
            Project Track may also contain capability or grade-level demand
            without a named employee. Resource Vision preserves this separately
            as demand rather than employee utilization.
          </p>
        </div>
      </div>
    </Card>
  );
}
