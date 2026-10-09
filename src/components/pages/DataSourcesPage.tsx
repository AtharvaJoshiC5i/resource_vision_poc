import { Info, ShieldCheck } from "lucide-react";

import {
  getDataSourceSummary,
  getDataStatusRows,
} from "../../services/dataSourcesService";

import { AvailabilityFormula } from "../data-sources/AvailabilityFormula";
import { DataFlowDiagram } from "../data-sources/DataFlowDiagram";
import { DataStatusTable } from "../data-sources/DataStatusTable";
import { PocProductionComparison } from "../data-sources/PocProductionComparison";
import { ResourceVisionOutput } from "../data-sources/ResourceVisionOutput";
import { SourceSystemCard } from "../data-sources/SourceSystemCard";
import { SourceTimeline } from "../data-sources/SourceTimeline";

import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { PageHeader } from "../ui/PageHeader";

export function DataSourcesPage() {
  const sources = getDataSourceSummary();

  const statusRows = getDataStatusRows();

  const enterpriseSources = sources.filter(
    (source) => source.kind === "enterprise",
  );

  const capacitySource = sources.find(
    (source) => source.id === "capacity-config",
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Sources"
        description="How Resource Vision combines employee, historical utilization and project planning data."
      />

      <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
        <div className="flex items-start gap-3">
          <Info
            className="mt-0.5 size-5 shrink-0 text-blue-600"
            aria-hidden="true"
          />

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-slate-900">
                Proof of Concept Data For Now
              </p>

              <Badge variant="blue">Synthetic Data</Badge>
            </div>

            <p className="mt-1 text-sm leading-6 text-slate-600">
              This demonstration uses synthetic, schema-aligned datasets to
              validate the Resource Vision data model and availability
              calculations. Production integrations will replace these datasets
              with authoritative source-system connections.
            </p>
          </div>
        </div>
      </div>

      <section aria-labelledby="source-systems-heading" className="space-y-4">
        <div>
          <h2
            id="source-systems-heading"
            className="text-lg font-semibold text-slate-900"
          >
            Source Systems
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Three conceptual inputs establish who resources are, what happened
            historically and what is planned.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          {enterpriseSources.map((source) => (
            <SourceSystemCard key={source.id} source={source} />
          ))}
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/40 px-4 py-3">
          <p className="text-xs leading-5 text-amber-900">
            <span className="font-semibold">POC data contract:</span> Famstack
            and ZingHR field mappings shown here represent the POC data contract
            and will be aligned to authoritative source schemas during
            integration.
          </p>
        </div>
      </section>

      {capacitySource !== undefined && (
        <section
          aria-labelledby="capacity-config-heading"
          className="space-y-4"
        >
          <div>
            <h2
              id="capacity-config-heading"
              className="text-lg font-semibold text-slate-900"
            >
              Supporting Configuration
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              A configurable POC assumption establishes standard monthly
              capacity.
            </p>
          </div>

          <div className="max-w-2xl">
            <SourceSystemCard source={capacitySource} />
          </div>
        </section>
      )}

      <DataFlowDiagram />

      <SourceTimeline />

      <AvailabilityFormula />

      <ResourceVisionOutput />

      <PocProductionComparison />

      <DataStatusTable rows={statusRows} />

      <Card>
        <div className="flex items-start gap-3">
          <ShieldCheck
            className="mt-0.5 size-5 shrink-0 text-slate-500"
            aria-hidden="true"
          />

          <div>
            <p className="text-sm font-semibold text-slate-900">
              POC confidentiality
            </p>

            <p className="mt-1 text-sm leading-6 text-slate-600">
              No production employee or project records are displayed in this
              POC. All application data shown in the demonstration is synthetic.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}