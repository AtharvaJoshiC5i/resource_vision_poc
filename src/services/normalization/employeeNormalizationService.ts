import type { Employee } from "../../types/domain";

import type { ZingHREmployee } from "../../types/zinghr";

import { UNSPECIFIED_GEO_LABEL } from "../../constants/capacityFallback";

export const DEFAULT_FTE_PERCENTAGE = 1;

function normalizeGeoLabel(value: string): string {
  const trimmed = value.trim();

  return trimmed === "" ? UNSPECIFIED_GEO_LABEL : trimmed;
}

function normalizeEmployeeDate(value: string): string {
  const trimmed = value.trim();

  if (trimmed === "") {
    return "";
  }

  const match = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);

  return match !== null ? match[1] : "";
}

export function normalizeEmployees(records: ZingHREmployee[]): Employee[] {
  return records.map((record) => ({
    employeeId: record.employee_id,

    employeeName: record.employee_name,

    employeeStatus:
      record.employment_status === "Active" ? "ACTIVE" : "INACTIVE",

    dateOfJoining: normalizeEmployeeDate(record.date_of_joining),

    lastWorkingDate: (() => {
      const leaving = normalizeEmployeeDate(record.date_of_leaving);

      return leaving === "" ? undefined : leaving;
    })(),

    primaryCapability: record.primary_capability,

    secondaryCapability: record.secondary_capability,

    department: record.department,

    grade: record.grade,

    location: normalizeGeoLabel(record.location),

    country: normalizeGeoLabel(record.country),

    /*
     * POC assumption:
     *
     * The current synthetic ZingHR dataset does
     * not provide an authoritative FTE percentage.
     *
     * Every employee is therefore treated as
     * 100% FTE for Availability V1.
     */
    ftePercentage: DEFAULT_FTE_PERCENTAGE,
  }));
}
