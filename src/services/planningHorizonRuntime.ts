import { FAMSTACK_MONTHS, POC_CURRENT_MONTH, PROJECT_TRACK_MONTHS } from "../constants/poc";

import type { PlanningHorizon } from "../types/planningHorizon";

let organizationHorizon: PlanningHorizon | null = null;

const mockHorizon: PlanningHorizon = {
  currentMonth: POC_CURRENT_MONTH,
  monthKeys: [...FAMSTACK_MONTHS, ...PROJECT_TRACK_MONTHS],
  famstackMonths: [...FAMSTACK_MONTHS],
  projectTrackMonths: [...PROJECT_TRACK_MONTHS],
};

export function setOrganizationPlanningHorizon(
  horizon: PlanningHorizon | null,
): void {
  organizationHorizon = horizon;
}

export function getActivePlanningHorizon(): PlanningHorizon {
  return organizationHorizon ?? mockHorizon;
}

export function getPlanningCurrentMonth(): string {
  return getActivePlanningHorizon().currentMonth;
}

export function getPlanningMonthKeys(): string[] {
  return getActivePlanningHorizon().monthKeys;
}

export function getProjectTrackPlanningMonths(): string[] {
  const horizon = getActivePlanningHorizon();

  return horizon.projectTrackMonths.length > 0
    ? horizon.projectTrackMonths
    : [...horizon.monthKeys];
}
