export type EmploymentStatus = "Active" | "Inactive";

export interface ZingHREmployee {
  employee_id: string;
  employee_name: string;
  email: string;
  primary_capability: string;
  secondary_capability: string;
  department: string;
  grade: string;
  location: string;
  country: string;
  employment_status: EmploymentStatus;
  date_of_joining: string;
  date_of_leaving: string;
  weekly_capacity_hours: number;
}
