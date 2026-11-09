import { useEffect, useId } from "react";
import { BookOpen, CircleDashed, X, type LucideIcon } from "lucide-react";

import type { AvailabilityStatus } from "../../api/types";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import { StatusChip } from "../ui/primitives";
import { STATUS_ICON, STATUS_ORDER, STATUS_STYLE } from "../../lib/status";

const STATUS_COPY: Record<AvailabilityStatus, { summary: string; detail: string }> = {
  "Fully Available": {
    summary: "No verified planned hours this month.",
    detail:
      "The employee has valid allocation records and verified zero planned hours, with full monthly capacity remaining. This status is rare when only non-zero efforts are recorded.",
  },
  "Partially Available": {
    summary: "Some capacity remains after planned hours.",
    detail:
      "Planned hours are verified and greater than zero, and remaining hours are above zero. The person can still take additional work within the 176 h monthly capacity.",
  },
  "Fully Committed": {
    summary: "No remaining capacity this month.",
    detail: "Verified planned hours equal monthly capacity (remaining hours round to zero).",
  },
  "Over-allocated": {
    summary: "Planned hours exceed monthly capacity.",
    detail: "Remaining hours are negative after verified planned effort is applied against the 176 h capacity.",
  },
  Unverified: {
    summary: "Hours or status could not be verified.",
    detail:
      "Applies when capacity or planned hours are unknown, HR is unmatched, records need review, or only placeholder rows exist. Includes zero-effort placeholders and unresolved effort.",
  },
};

const NO_RECORD = {
  title: "No record",
  icon: CircleDashed,
  summary: "No Project Track row for this employee in the month.",
  detail:
      "The reporting month has data, but this person has no named allocation row. Shown as — in the matrix. Different from blank months where Project Track has no data at all.",
  tone: { bg: "var(--color-canvas)", fg: "var(--color-ink-soft)" },
};

function GuideCard({
  title,
  icon: Icon,
  summary,
  detail,
  status,
  tone,
}: {
  title: string;
  icon: LucideIcon;
  summary: string;
  detail: string;
  status?: AvailabilityStatus;
  tone?: { bg: string; fg: string };
}) {
  const colors = status ? { bg: STATUS_STYLE[status].bg, fg: STATUS_STYLE[status].fg } : tone!;
  return (
    <li className="rounded-xl border border-hairline bg-surface p-4 shadow-(--shadow-card)">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
          style={{ backgroundColor: colors.bg, color: colors.fg }}
        >
          <Icon className="h-4 w-4" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[13px] font-semibold text-ink">{title}</h3>
            {status && <StatusChip status={status} size="sm" />}
          </div>
          <p className="mt-1 text-[12px] font-medium text-ink-soft">{summary}</p>
          <p className="mt-1.5 text-[12px] leading-5 text-muted">{detail}</p>
        </div>
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
      <button type="button" aria-label="Close guide" className="absolute inset-0 bg-ink/45" onClick={onClose} />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        id={dialogId}
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex pb-[env(safe-area-inset-bottom)] outline-none max-h-[min(90dvh,40rem)] w-full max-w-lg flex-col rounded-t-2xl border border-hairline bg-surface shadow-(--shadow-popover) sm:max-w-xl sm:rounded-2xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-hairline px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Reference</p>
            <h2 id={titleId} className="mt-0.5 text-base font-semibold text-ink">
              Availability statuses
            </h2>
            <p className="mt-1 text-[12px] leading-5 text-muted">
              Planned allocation categories used in the matrix, KPIs, and Employee 360. Capacity is 176 h per employed month.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 touch:h-11 touch:w-11 shrink-0 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4 sm:px-6">
          {STATUS_ORDER.map((status) => (
            <GuideCard
              key={status}
              title={status}
              icon={STATUS_ICON[status]}
              status={status}
              summary={STATUS_COPY[status].summary}
              detail={STATUS_COPY[status].detail}
            />
          ))}
          <GuideCard
            title={NO_RECORD.title}
            icon={NO_RECORD.icon}
            summary={NO_RECORD.summary}
            detail={NO_RECORD.detail}
            tone={NO_RECORD.tone}
          />
        </ul>
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
