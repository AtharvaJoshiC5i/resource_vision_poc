import type { ReactNode } from "react";

import { useScrollEdges } from "../../hooks/useScrollEdges";

/**
 * A table is its own card (after Untitled UI's TableCard): one bordered surface holding a header
 * (title, count badge, description, actions), an optional toolbar row, the table edge to edge,
 * and a footer for pagination or notes. Nothing is framed twice.
 */
export function TableCard({
  title,
  titleId,
  count,
  description,
  actions,
  toolbar,
  footer,
  children,
  className = "",
}: {
  title: string;
  titleId?: string;
  /** Short count shown as a badge beside the title, e.g. "312 employees". */
  count?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Row under the header for legends, view switches or quick filters. */
  toolbar?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={titleId}
      className={`rv-table-card rv-frame flex min-w-0 flex-col overflow-hidden rounded-xl ${className}`}
    >
      <header className="rv-rule-b flex flex-col items-start gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h2 id={titleId} className="text-base font-medium leading-6 tracking-[-0.011em] text-ink">
              {title}
            </h2>
            {count != null ? <span className="rv-title-count">{count}</span> : null}
          </div>
          {description ? <p className="max-w-3xl text-sm leading-5 text-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </header>
      {toolbar ? <div className="rv-rule-b px-4 py-3 sm:px-5">{toolbar}</div> : null}
      <div className="min-h-0 flex-1">{children}</div>
      {footer ? <div className="rv-table-card__footer rv-rule-t px-4 py-3 sm:px-5">{footer}</div> : null}
    </section>
  );
}

/** Scroll area for a table inside a TableCard: no border of its own, sticky header and column. */
export function TableScroll({
  children,
  className = "",
  label,
}: {
  children: ReactNode;
  className?: string;
  label: string;
}) {
  const ref = useScrollEdges();
  return (
    <div
      ref={ref}
      tabIndex={0}
      role="region"
      aria-label={label}
      className={`rv-scroll overflow-auto overscroll-contain focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${className}`}
    >
      {children}
    </div>
  );
}
