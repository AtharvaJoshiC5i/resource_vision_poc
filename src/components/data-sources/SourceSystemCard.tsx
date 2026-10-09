import type { DataSourceSummary } from "../../types/dataSources";

import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";

interface SourceSystemCardProps {
  source: DataSourceSummary;
}

export function SourceSystemCard({ source }: SourceSystemCardProps) {
  const Icon = source.icon;

  const configuration = source.kind === "configuration";

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${
              configuration
                ? "border-slate-200 bg-slate-100"
                : "border-blue-100 bg-blue-50"
            }`}
          >
            <Icon
              className={`size-5 ${
                configuration ? "text-slate-600" : "text-blue-600"
              }`}
              aria-hidden="true"
            />
          </div>

          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {source.name}
            </h2>

            <p className="mt-0.5 text-xs font-medium text-slate-500">
              {source.role}
            </p>
          </div>
        </div>

        <Badge variant={configuration ? "neutral" : "blue"}>
          {configuration ? "POC Config" : "POC Source"}
        </Badge>
      </div>

      {source.question !== undefined && (
        <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-blue-700">
          {source.question}
        </p>
      )}

      <p className="mt-2 text-sm leading-6 text-slate-600">
        {source.description}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="text-xl font-semibold tracking-tight text-slate-900">
          {source.recordCount.toLocaleString("en-US")}
        </span>

        <span className="text-sm text-slate-500">{source.recordLabel}</span>

        {source.period !== undefined && (
          <>
            <span className="text-slate-300" aria-hidden="true">
              ·
            </span>

            <span className="text-sm text-slate-500">{source.period}</span>
          </>
        )}
      </div>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <p className="text-xs font-medium text-slate-500">
          Representative data
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {source.fields.map((field) => (
            <span
              key={field}
              className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600"
            >
              {field}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <p className="text-xs text-slate-500">
          <span className="font-medium text-slate-700">
            {configuration ? "POC configuration" : "POC Source"}
          </span>
          {" · "}
          {configuration ? "Configurable assumption" : "Synthetic Dataset"}
        </p>
      </div>
    </Card>
  );
}
