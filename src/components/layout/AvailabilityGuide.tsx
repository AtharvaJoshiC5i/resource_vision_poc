import { useEffect, useId } from "react";
import { BookOpen, CircleDashed, X } from "lucide-react";

import type { AvailabilityStatus } from "../../api/types";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import { StatusBadge } from "../ui/primitives";
import { STATUS_ORDER, STATUS_STYLE } from "../../lib/status";

const STATUS_COPY: Record<AvailabilityStatus, { summary: string; detail: string }> = {
  "Fully Available": {
    summary: "No verified planned hours this month",
    detail:
      "Valid allocation records with verified zero planned hours and full monthly capacity remaining. Uncommon when only non-zero efforts are recorded.",
  },
  "Partially Available": {
    summary: "Some capacity remains after planned hours",
    detail:
      "Verified planned hours are above zero and remaining hours are positive. The person can still take work within the 176 h monthly capacity.",
  },
  "Fully Committed": {
    summary: "No remaining capacity this month",
    detail: "Verified planned hours equal monthly capacity; remaining hours round to zero.",
  },
  "Over-allocated": {
    summary: "Planned hours exceed monthly capacity",
    detail: "Remaining hours are negative after verified planned effort is applied against the 176 h capacity.",
  },
  Unverified: {
    summary: "Hours or status could not be verified",
    detail:
      "Capacity or planned hours are unknown, HR is unmatched, records need review, or only placeholder rows exist.",
  },
};

const NO_RECORD = {
  title: "No record",
  summary: "No Project Track row for this employee in the month",
  detail:
    "The reporting month has data, but this person has no named allocation row (shown as — in the matrix). Distinct from months where Project Track has no data at all.",
};

function GuideRow({
  status,
  summary,
  detail,
}: {
  status?: AvailabilityStatus;
  summary: string;
  detail: string;
}) {
  const accent = status ? STATUS_STYLE[status].chart : "var(--color-border)";

  return (
    <li className="relative flex gap-4 px-5 py-4 sm:px-6 sm:py-[1.125rem]">
      <span
        aria-hidden="true"
        className="absolute inset-y-3 left-0 w-[3px] rounded-r-full sm:inset-y-3.5"
        style={{ backgroundColor: accent }}
      />
      <div className="min-w-0 flex-1 pl-2">
        {status ? (
          <StatusBadge status={status} />
        ) : (
          <span className="inline-flex h-6 max-w-full items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-md bg-canvas px-2 text-xs font-medium text-ink-soft">
            <CircleDashed aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted" strokeWidth={1.75} />
            <span>{NO_RECORD.title}</span>
          </span>
        )}
        <p className="mt-2 text-sm font-medium leading-snug text-ink-soft">{summary}</p>
        <p className="mt-1.5 text-xs leading-[1.45] text-muted">{detail}</p>
      </div>
    </li>
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
        className="absolute inset-0 bg-ink/40 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        id={dialogId}
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex pb-[env(safe-area-inset-bottom)] outline-none max-h-[min(90dvh,42rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-hairline bg-surface shadow-(--shadow-popover) sm:max-w-xl sm:rounded-2xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-hairline px-5 py-5 sm:px-6">
          <div className="min-w-0 pr-2">
            <h2 id={titleId} className="text-lg font-medium leading-snug text-ink">
              Availability statuses
            </h2>
            <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted">
              How planned allocation appears in the matrix, KPIs, and Employee 360. Monthly capacity is 176 h per
              employed month.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 touch:h-11 touch:w-11 shrink-0 place-items-center rounded-full border border-transparent text-muted transition-colors hover:border-hairline hover:bg-canvas hover:text-ink"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="rv-scroll min-h-0 flex-1 overflow-y-auto">
          <ul className="divide-y divide-hairline">
            {STATUS_ORDER.map((status) => (
              <GuideRow
                key={status}
                status={status}
                summary={STATUS_COPY[status].summary}
                detail={STATUS_COPY[status].detail}
              />
            ))}
            <GuideRow summary={NO_RECORD.summary} detail={NO_RECORD.detail} />
          </ul>
        </div>
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
      className={`flex w-full items-center gap-2.5 rounded-lg text-[12px] font-medium text-muted transition-colors hover:bg-canvas hover:text-ink ${
        expanded ? "h-9 touch:h-11 px-2.5" : "mx-auto h-9 w-9 touch:h-11 touch:w-11 justify-center px-0"
      }`}
    >
      <BookOpen aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.8} />
      {expanded && <span className="truncate">Availability statuses</span>}
    </button>
  );
}
