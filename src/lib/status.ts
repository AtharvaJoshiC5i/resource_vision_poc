import { BriefcaseBusiness, ShieldQuestionMark, TriangleAlert, UserRoundCheck, UserRoundPlus, type LucideIcon } from "lucide-react";

import type { AvailabilityStatus, ContractCategory } from "../api/types";

/*
 * Colours are references to the tokens in index.css, never literals.
 * Status is always shown with a letter or label as well as a colour.
 */
export const STATUS_ORDER: AvailabilityStatus[] = [
  "Fully Available",
  "Partially Available",
  "Fully Committed",
  "Over-allocated",
  "Unverified",
];

export const STATUS_ICON: Record<AvailabilityStatus, LucideIcon> = {
  "Fully Available": UserRoundCheck,
  "Partially Available": UserRoundPlus,
  "Fully Committed": BriefcaseBusiness,
  "Over-allocated": TriangleAlert,
  Unverified: ShieldQuestionMark,
};

/** `chart` is the solid series colour; `bg`/`fg` are the tinted chip surface and its readable text. */
export const STATUS_STYLE: Record<AvailabilityStatus, { letter: string; bg: string; fg: string; chart: string }> = {
  "Fully Available": {
    letter: "F",
    bg: "var(--color-success-soft)",
    fg: "var(--color-success-ink)",
    chart: "var(--color-success)",
  },
  "Partially Available": {
    letter: "P",
    bg: "var(--color-primary-soft)",
    fg: "var(--color-primary)",
    chart: "var(--color-primary)",
  },
  "Fully Committed": {
    letter: "C",
    bg: "var(--color-lavender-soft)",
    fg: "var(--color-purple-indigo)",
    chart: "var(--color-lavender-light)",
  },
  "Over-allocated": {
    letter: "O",
    bg: "var(--color-error-soft)",
    fg: "var(--color-error-ink)",
    chart: "var(--color-error)",
  },
  Unverified: {
    letter: "U",
    bg: "var(--color-warning-soft)",
    fg: "var(--color-warning-ink)",
    chart: "var(--color-warning)",
  },
};

export const CONTRACT_ORDER: ContractCategory[] = ["FTE-Based", "Program-Based", "Contract Not Specified"];

export const CONTRACT_CHART_COLOR: Record<ContractCategory, string> = {
  "FTE-Based": "var(--color-primary)",
  "Program-Based": "var(--color-lavender-light)",
  "Contract Not Specified": "var(--color-border)",
};

/** Project status tone (catalog rule: approval in progress needs attention, active/approved is positive). */
export function projectStatusTone(status: string): { bg: string; fg: string } {
  const upper = status.toUpperCase();
  if (upper.includes("APPROV") && !upper.includes("APPROVED")) {
    return { bg: "var(--color-warning-soft)", fg: "var(--color-warning-ink)" };
  }
  if (upper === "ACTIVE" || upper === "APPROVED") {
    return { bg: "var(--color-success-soft)", fg: "var(--color-success-ink)" };
  }
  return { bg: "var(--color-canvas)", fg: "var(--color-ink-soft)" };
}

/** Matrix status-filter token for employees with no Project Track row in a month that has data. */
export const NO_RECORD_FILTER = "No record";
