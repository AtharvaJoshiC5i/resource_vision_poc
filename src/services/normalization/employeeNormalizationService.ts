import type { Employee } from "../../types/domain";

import type { ZingHREmployee } from "../../types/zinghr";

export const DEFAULT_FTE_PERCENTAGE = 1;

export function normalizeEmployees(records: ZingHREmployee[]): Employee[] {
  return records.map((record) => ({
    employeeId: record.employee_id,

    employeeName: record.employee_name,

    employeeStatus:
      record.employment_status === "Active" ? "ACTIVE" : "INACTIVE",

    dateOfJoining: record.date_of_joining,

    lastWorkingDate:
      record.date_of_leaving.trim() === "" ? undefined : record.date_of_leaving,

    primaryCapability: record.primary_capability,

    secondaryCapability: record.secondary_capability,

    department: record.department,

    grade: record.grade,

    location: record.location,

    country: record.country,

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
