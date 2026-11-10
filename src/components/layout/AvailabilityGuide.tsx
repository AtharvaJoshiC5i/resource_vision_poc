import { useEffect, useId } from "react";
import { BookOpen, CircleDashed, X } from "lucide-react";

import type { AvailabilityStatus } from "../../api/types";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import { StatusBadge } from "../ui/primitives";
import { STATUS_ORDER } from "../../lib/status";

const STATUS_COPY: Record<AvailabilityStatus, { summary: string; detail: string }> = {
  "Fully Available": {
    summary: "No verified planned hours this month",
    detail:
      "Allocation exists with verified zero planned hours, so full monthly capacity remains. Uncommon when only non-zero efforts are recorded.",
  },
  "Partially Available": {
    summary: "Some capacity remains after planned hours",
    detail:
      "Planned hours are above zero and remaining capacity is positive. The person can take more work within the 176 h monthly limit.",
  },
  "Fully Committed": {
    summary: "No remaining capacity this month",
    detail: "Verified planned hours equal monthly capacity; remaining hours round to zero.",
  },
  "Over-allocated": {
    summary: "Planned hours exceed monthly capacity",
    detail: "Remaining hours are negative after planned effort is applied against the 176 h capacity.",
  },
  Unverified: {
    summary: "Planned hours are zero for the month",
    detail:
      "When effort recorded for the month is 0 h, availability cannot be classified as available, committed, or over-allocated, so the status is Unverified.",
  },
};

const NO_RECORD = {
  title: "No record",
  summary: "No Project Track row for this employee in the month",
  detail:
    "The month has data in scope, but this person has no allocation row (shown as — in the matrix). Different from a blank month with no Project Track data.",
};

function GuideStatusCard({
  status,
  summary,
  detail,
}: {
  status?: AvailabilityStatus;
  summary: string;
  detail: string;
}) {
  return (
    <article className="rounded-xl border border-hairline bg-surface p-4 shadow-(--shadow-card) ring-1 ring-inset ring-ink/[0.03]">
      {status ? (
        <StatusBadge status={status} />
      ) : (
        <span className="rv-chip h-6 gap-1.5 text-ink-soft">
          <CircleDashed aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted" strokeWidth={1.75} />
          {NO_RECORD.title}
        </span>
      )}
      <p className="mt-2.5 text-sm font-medium leading-snug text-ink-soft">{summary}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">{detail}</p>
    </article>
  );
}

export function AvailabilityGuidePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const titleId = useId();
  const dialogId = useId();
  const dialogRef = useDialogFocus(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close guide"
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        id={dialogId}
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[min(90dvh,40rem)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-hairline bg-canvas pb-[env(safe-area-inset-bottom)] shadow-(--shadow-popover) outline-none sm:max-w-lg sm:rounded-2xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-hairline bg-surface px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-medium text-ink">
              Availability statuses
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Definitions used in the matrix, summary KPIs, and Employee 360
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 touch:h-11 touch:w-11 shrink-0 place-items-center rounded-full border border-transparent text-muted transition-colors hover:border-hairline hover:bg-canvas hover:text-ink"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="rv-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
          <ul className="space-y-2.5" role="list">
            {STATUS_ORDER.map((status) => (
              <li key={status}>
                <GuideStatusCard
                  status={status}
                  summary={STATUS_COPY[status].summary}
                  detail={STATUS_COPY[status].detail}
                />
              </li>
            ))}
            <li>
              <GuideStatusCard summary={NO_RECORD.summary} detail={NO_RECORD.detail} />
            </li>
          </ul>
        </div>

        <footer className="shrink-0 border-t border-hairline bg-surface px-5 py-3 text-xs leading-relaxed text-muted sm:px-6">
          Monthly capacity is <span className="font-medium tabular-nums text-ink-soft">176 h</span> for each employed
          month in the reporting window.
        </footer>
      </div>
    </div>
  );
}

/** Sidebar control; full label when expanded, icon-only when collapsed. */
export function AvailabilityGuideTrigger({
  expanded,
  onOpen,
}: {
  expanded: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title={expanded ? undefined : "Availability statuses"}
      className={`flex w-full items-center gap-2.5 rounded-lg text-xs font-medium text-muted transition-colors hover:bg-canvas hover:text-ink ${
        expanded ? "h-9 touch:h-11 px-2.5" : "mx-auto h-9 w-9 touch:h-11 touch:w-11 justify-center px-0"
      }`}
    >
      <BookOpen aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.75} />
      {expanded && <span className="truncate">Availability statuses</span>}
    </button>
  );
}
