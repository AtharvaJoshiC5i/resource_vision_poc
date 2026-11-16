import { ArrowLeft, ArrowRight } from "lucide-react";

import { buildPaginationItems } from "../../lib/pagination";

export function TablePagination({
  page,
  pages,
  onChange,
}: {
  page: number;
  pages: number;
  /** Kept for call-site compatibility with API metadata. */
  total?: number;
  pageSize?: number;
  onChange: (page: number) => void;
  itemLabel?: string;
}) {
  if (pages <= 1) return null;

  const pageItems = buildPaginationItems(page, pages);

  return (
    <nav aria-label="Pagination" className="rv-table-pagination">
      <p className="sr-only" aria-live="polite">
        Page {page} of {pages}
      </p>

      <button
        type="button"
        className="rv-table-pagination__nav"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="Previous page"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Previous
      </button>

      <ol className="rv-table-pagination__pages" role="list">
        {pageItems.map((item, index) =>
          item === "ellipsis" ? (
            <li key={`gap-${index}`} className="rv-table-pagination__ellipsis" aria-hidden="true">
              …
            </li>
          ) : item === page ? (
            <li key={item}>
              <span className="rv-table-pagination__page rv-table-pagination__page--active" aria-current="page">
                {item}
              </span>
            </li>
          ) : (
            <li key={item}>
              <button type="button" className="rv-table-pagination__page" onClick={() => onChange(item)} aria-label={`Page ${item}`}>
                {item}
              </button>
            </li>
          ),
        )}
      </ol>

      <button
        type="button"
        className="rv-table-pagination__nav"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
        aria-label="Next page"
      >
        Next
        <ArrowRight aria-hidden="true" className="h-4 w-4" />
      </button>
    </nav>
  );
}