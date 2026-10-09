import type { EmployeeMonthAvailability } from "../types/domain";

import type { ResourceTimingStatus } from "../constants/resourcePlanning";

import { compareMonthKeys, createMonthKey } from "./monthService";

export interface AvailabilityTimingResult {
  employeeId: string;
  employeeName: string;

  requirementStartDate: string;
  requirementMonth: string;

  status: ResourceTimingStatus;

  availableHours: number;
  totalCapacityHours: number;

  requiredHours?: number;
  meetsRequiredHours?: boolean;

  isFullyAvailable: boolean;

  timingPrecision: "MONTH";
  explanation: string;
}

function parseRequirementDate(value: string): {
  year: number;
  month: number;
  day: number;
} {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());

  if (!match) {
    throw new Error(`Invalid requirement start date: ${value}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`Invalid requirement start date: ${value}`);
  }

  return { year, month, day };
}

export function isAvailableByRequirementStart(
  records: readonly EmployeeMonthAvailability[],
  employeeId: string,
  requirementStartDate: string,
  requiredHours?: number,
): AvailabilityTimingResult | null {
  const { year, month } = parseRequirementDate(requirementStartDate);

  const requirementMonth = createMonthKey(year, month);

  if (
    requiredHours !== undefined &&
    (!Number.isFinite(requiredHours) || requiredHours <= 0)
  ) {
    throw new Error("requiredHours must be a positive finite number.");
  }

  const record = records.find(
    (item) =>
      item.employeeId === employeeId && item.monthKey === requirementMonth,
  );

  if (!record) {
    return null;
  }

  const active = record.workforceState === "ACTIVE";

  const availableHours = active ? record.availableHours : 0;

  const isFullyAvailable =
    active &&
    record.totalCapacityHours > 0 &&
    record.allocatedHours === 0 &&
    record.status === "AVAILABLE";

  let status: ResourceTimingStatus;

  if (!active || availableHours <= 0) {
    status = "NOT_AVAILABLE_BY_START";
  } else if (isFullyAvailable) {
    status = "AVAILABLE_BY_START";
  } else {
    status = "PARTIALLY_AVAILABLE_BY_START";
  }

  const meetsRequiredHours =
    requiredHours === undefined
      ? undefined
      : active && availableHours >= requiredHours;

  let explanation: string;

  if (!active) {
    explanation = "The employee is not active in the requirement month.";
  } else if (status === "NOT_AVAILABLE_BY_START") {
    explanation = `No usable capacity is recorded for ${requirementMonth}.`;
  } else if (isFullyAvailable) {
    explanation = `${availableHours}h of full monthly capacity is available in ${requirementMonth}.`;
  } else {
    explanation = `${availableHours}h of partial monthly capacity is available in ${requirementMonth}.`;
  }

  explanation +=
    " This is a monthly planning estimate, not an exact-day guarantee.";

  return {
    employeeId,
    employeeName: record.employeeName,

    requirementStartDate,
    requirementMonth,

    status,
    availableHours,
    totalCapacityHours: record.totalCapacityHours,

    requiredHours,
    meetsRequiredHours,

    isFullyAvailable,
    timingPrecision: "MONTH",
    explanation,
  };
}

export function getFirstUsableCapacityMonth(
  records: readonly EmployeeMonthAvailability[],
  employeeId: string,
  fromMonth: string,
  requiredHours = 0,
): string | null {
  if (!Number.isFinite(requiredHours) || requiredHours < 0) {
    throw new Error("requiredHours must be a non-negative finite number.");
  }

  const matching = records
    .filter(
      (record) =>
        record.employeeId === employeeId &&
        record.workforceState === "ACTIVE" &&
        compareMonthKeys(record.monthKey, fromMonth) >= 0 &&
        record.availableHours > 0 &&
        record.availableHours >= requiredHours,
    )
    .sort((a, b) => compareMonthKeys(a.monthKey, b.monthKey));

  return matching[0]?.monthKey ?? null;
}
