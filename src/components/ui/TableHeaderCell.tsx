import type { ReactNode } from "react";

interface TableHeaderCellProps {
  children: ReactNode;
  align?: "left" | "center" | "right";
  className?: string;
}

/**
 * Shared table header styling for consistent readability
 * across data-heavy views.
 */
export function TableHeaderCell({
  children,
  align = "left",
  className = "",
}: TableHeaderCellProps) {
  const alignClass =
    align === "right"
      ? "text-right"
      : align === "center"
        ? "text-center"
        : "text-left";

  return (
    <th
      scope="col"
      className={`border-b border-slate-200 px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-600 ${alignClass} ${className}`}
    >
      {children}
    </th>
  );
}
