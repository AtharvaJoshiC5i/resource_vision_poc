import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  supportingText: string;
  icon: LucideIcon;
  negative?: boolean;
}

export function MetricCard({
  title,
  value,
  supportingText,
  icon: Icon,
  negative = false,
}: MetricCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{title}</p>

          <p
            className={`mt-3 text-2xl font-semibold tracking-tight ${
              negative ? "text-red-700" : "text-slate-900"
            }`}
          >
            {value}
          </p>

          <p className="mt-1.5 text-xs text-slate-500">{supportingText}</p>
        </div>

        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
          <Icon className="size-4.5 text-slate-500" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
