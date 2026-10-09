import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {title}
        </h1>

        {description !== undefined && (
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600">
            {description}
          </p>
        )}
      </div>

      {actions !== undefined && <div className="shrink-0">{actions}</div>}
    </div>
  );
}
