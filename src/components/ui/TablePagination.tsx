import { ChevronLeft, ChevronRight } from "lucide-react";

const DEFAULT_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

export interface TablePaginationProps {
  totalItems: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: readonly number[];
  itemLabel?: string;
}

function getPageRange(
  totalItems: number,
  page: number,
  pageSize: number,
): { start: number; end: number } {
  if (totalItems === 0) {
    return { start: 0, end: 0 };
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return { start, end };
}

export function TablePagination({
  totalItems,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  itemLabel = "items",
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const { start, end } = getPageRange(totalItems, safePage, pageSize);

  const canGoPrevious = safePage > 1;
  const canGoNext = safePage < totalPages;

  return (
    <div
      className="flex flex-col gap-3 border-t border-slate-100 bg-white px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between"
      aria-label="Table pagination"
    >
      <p className="text-sm text-slate-600">
        {totalItems === 0 ? (
          <>No {itemLabel}</>
        ) : (
          <>
            Showing{" "}
            <span className="font-semibold text-slate-900">
              {start.toLocaleString("en-US")}–{end.toLocaleString("en-US")}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-slate-900">
              {totalItems.toLocaleString("en-US")}
            </span>{" "}
            {totalItems === 1 ? itemLabel.replace(/s$/, "") : itemLabel}
          </>
        )}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        {onPageSizeChange !== undefined && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Rows per page
            <select
              value={pageSize}
              onChange={(event) => {
                onPageSizeChange(Number(event.target.value));
                onPageChange(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(safePage - 1)}
            disabled={!canGoPrevious}
            aria-label="Previous page"
            className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>

          <span className="min-w-[7.5rem] text-center text-sm text-slate-600">
            Page{" "}
            <span className="font-semibold text-slate-900">{safePage}</span> of{" "}
            <span className="font-semibold text-slate-900">{totalPages}</span>
          </span>

          <button
            type="button"
            onClick={() => onPageChange(safePage + 1)}
            disabled={!canGoNext}
            aria-label="Next page"
            className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
