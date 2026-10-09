import { POC_CURRENT_MONTH } from "../constants/poc";

import type { AllocationSource } from "../types/domain";

import { compareMonthKeys } from "./monthService";

/*
 * Resource Vision POC source-period rule.
 *
 * Historical actuals:
 *     before September 2026
 *     -> Famstack
 *
 * Current + future planning:
 *     September 2026 onward
 *     -> Project Track
 *
 * This service deliberately does not contain
 * an end date. Therefore future planning months
 * such as January, February and March 2027
 * automatically remain Project Track months.
 *
 * The comparison uses canonical YYYY-MM month
 * keys and never depends on the browser's
 * current date.
 */
export function getSourceForMonth(monthKey: string): AllocationSource {
  const comparison = compareMonthKeys(monthKey, POC_CURRENT_MONTH);

  if (comparison < 0) {
    return "FAMSTACK";
  }

  return "PROJECT_TRACK";
}
