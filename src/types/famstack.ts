export type FamstackBillingType = "Billable" | "Non-Billable";

export type FamstackWorkCategory = "Project" | "Internal";

export interface FamstackRecord {
  employee_id: string;
  month_key: string;
  year: number;
  project_id: string;
  proposal_number: string;
  project_name: string;
  billing_type: FamstackBillingType;
  work_category: FamstackWorkCategory;
  billable_hours: number;
  non_billable_hours: number;
  leave_hours: number;
  actual_effort_hours: number;
  total_logged_hours: number;
}
