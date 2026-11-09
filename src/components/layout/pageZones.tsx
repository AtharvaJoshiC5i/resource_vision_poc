import { forwardRef, type ReactNode } from "react";

import { Card, SectionHeader, quietButtonClass } from "../ui/primitives";

/** Uniform vertical rhythm between page zones. */
export function PageZones({ children }: { children: ReactNode }) {
  return <div className="space-y-6">{children}</div>;
}

/** Zone 2: filter controls with a consistent title and optional reset. */
export function FilterCard({
  subtitle,
  onReset,
  resetDisabled,
  filterCount,
  filterTotal,
  children,
}: {
  subtitle?: string;
  onReset?: () => void;
  resetDisabled?: boolean;
  filterCount?: number;
  filterTotal?: number;
  children: ReactNode;
}) {
  const resolvedSubtitle =
    subtitle ??
    (filterCount !== undefined && filterTotal !== undefined
      ? filterCount > 0
        ? `${filterCount} of ${filterTotal} filters applied`
        : "Showing all records in scope"
      : undefined);

  return (
    <Card
      title="Filters"
      subtitle={resolvedSubtitle}
      actions={
        onReset ? (
          <button type="button" onClick={onReset} disabled={resetDisabled} className={quietButtonClass}>
            Reset filters
          </button>
        ) : undefined
      }
    >
      {children}
    </Card>
  );
}

/** Zone 3: headline metrics before the primary table. */
export function SummarySection({
  id = "summary-heading",
  title = "Summary",
  subtitle,
  footnote,
  children,
}: {
  id?: string;
  title?: string;
  subtitle?: ReactNode;
  footnote?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <SectionHeader id={id} title={title} subtitle={subtitle} />
      {children}
      {footnote && <p className="mt-3 text-xs leading-5 text-muted">{footnote}</p>}
    </section>
  );
}

/** Master–detail landmark: receives focus after selection; use with scrollIntoView. */
export const MasterDetailLandmark = forwardRef<
  HTMLElement,
  {
    label: string;
    children: ReactNode;
    className?: string;
  }
>(function MasterDetailLandmark({ label, children, className = "" }, ref) {
  return (
    <section
      ref={ref}
      tabIndex={-1}
      aria-label={label}
      className={`scroll-mt-6 space-y-6 outline-none ${className}`}
    >
      {children}
    </section>
  );
});
