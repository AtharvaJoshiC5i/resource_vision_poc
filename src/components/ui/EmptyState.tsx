import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
}: EmptyStateProps) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center px-6 py-10 text-center">
      <div className="flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
        <Icon className="size-5 text-slate-500" aria-hidden="true" />
      </div>

      <h2 className="mt-4 text-sm font-semibold text-slate-900">{title}</h2>

      <p className="mt-1.5 max-w-md text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  );
}
