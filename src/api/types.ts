/** Response shapes of the Resource Vision API (backend/app/rv/views.py). */

export type AvailabilityStatus =
  | "Fully Available"
  | "Partially Available"
  | "Fully Committed"
  | "Over-allocated"
  | "Unverified";

export type ContractCategory =
  | "FTE-Based"
  | "Program-Based"
  | "Contract Not Specified";

export interface MonthOption {
  key: number;
  label: string;
  has_data: boolean;
}

export interface Meta {
  today: string;
  capacity_hours: number;
  window: MonthOption[];
  source: string;
  data_quality: Record<string, number>;
}

export interface AvailabilityOptions {
  months: MonthOption[];
  contract_categories: ContractCategory[];
  divisions: string[];
  capabilities: string[];
  grades: string[];
  locations: string[];
}

export interface AvailabilityMonth {
  month: number;
  label: string;
  has_data: boolean;
  total: number | null;
  statuses: Record<AvailabilityStatus, number | null>;
  contracts: Record<ContractCategory, number | null>;
}

export interface AvailabilityOverview {
  kpis: {
    employees_with_records: number;
    fully_available: number;
    partially_available: number;
    fully_committed: number;
    over_allocated: number;
    unverified: number;
  };
  months: AvailabilityMonth[];
}

export type MatrixCell =
  | { month: number; state: "blank" }
  | { month: number; state: "none" }
  | {
      month: number;
      state: "status";
      status: AvailabilityStatus;
      letter: "F" | "P" | "C" | "O" | "U";
      remaining_hours: number | null;
      planned_hours: number | null;
      reason: string;
      contract_category: ContractCategory;
    };

export interface AvailabilityMatrix {
  months: { key: number; label: string }[];
  rows: { key: string; code: string; name: string; hr_match: boolean; cells: MatrixCell[] }[];
  page: number;
  pages: number;
  page_size: number;
  total: number;
}

export interface EmployeeOption {
  key: string;
  code: string;
  name: string;
  label: string;
}

export interface DirectoryRow {
  key: string;
  code: string;
  name: string;
  grade: string | null;
  capability: string | null;
  location: string | null;
  hr_match: boolean;
  /** Status for the current month; null when the employee has no record that month. */
  status: AvailabilityStatus | null;
  projects: number | null;
  planned_hours: number | null;
  capacity_hours: number | null;
  remaining_hours: number | null;
  utilisation: number | null;
  available_from: { month: number; label: string; remaining_hours: number } | null;
}

export interface EmployeeDirectory {
  month: number;
  month_label: string;
  kpis: {
    total: number;
    over_allocated: number;
    unverified: number;
    fully_committed: number;
    partially_available: number;
    fully_available: number;
    no_record: number;
  };
  rows: DirectoryRow[];
  attention: { total: number; items: { key: string; code: string; name: string; status: AvailabilityStatus; reason: string }[] };
  freeing: {
    months: number;
    total: number;
    items: { key: string; code: string; name: string; month: number; label: string; hours_freed: number }[];
  };
}

export interface EmployeeMonthRow {
  month: number;
  label: string;
  has_data: boolean;
  present: boolean;
  project_count: number | null;
  contract_category: ContractCategory | null;
  planned_hours: number | null;
  unresolved_hours: number | null;
  remaining_hours: number | null;
  status: AvailabilityStatus | null;
  status_reason: string | null;
}

export interface AllocationChild {
  sub_project: string;
  planned_hours: number | null;
  unresolved_hours: number | null;
}

export interface AllocationRow {
  month: number;
  label: string;
  project_id: string;
  client_bu: string;
  status: string;
  contract: string;
  start: string | null;
  end: string | null;
  planned_hours: number | null;
  unresolved_hours: number | null;
  children: AllocationChild[];
}

export interface EmployeeDetail {
  profile: {
    key: string;
    code: string;
    name: string;
    initials: string;
    status: string | null;
    hr_match_status: string;
    primary_capability: string | null;
    secondary_capability: string | null;
    grade: string | null;
    division: string | null;
    department: string | null;
    location: string | null;
    country: string | null;
    manager: string | null;
    employment_type: string | null;
    joining_date: string | null;
    email: string | null;
  };
  months: EmployeeMonthRow[];
  totals: {
    project_count: number;
    contract_category: string;
    planned_hours: number | null;
    unresolved_hours: number | null;
    status: string | null;
  };
  allocations: {
    rows: AllocationRow[];
    totals: { planned_hours: number | null; unresolved_hours: number | null };
  };
}

export interface ProjectOptions {
  months: MonthOption[];
  contract_categories: ContractCategory[];
  coverage: string[];
  projects: { id: string; label: string }[];
}

export interface ProjectRow {
  id: string;
  name: string;
  client_bu: string;
  contract_category: string;
  status: string;
  start: string | null;
  end: string | null;
  employees: number;
  planned_hours: number | null;
}

export interface ProjectsOverview {
  kpis: {
    total_projects: number;
    active_projects: number;
    projects_with_employees: number;
    employees_assigned: number;
  };
  rows: ProjectRow[];
}

export interface ProjectDetail {
  project: {
    id: string;
    name: string;
    status: string;
    client_bu: string;
    contract_category: string;
    contract_type: string;
    lead: string;
    description: string;
    start: string | null;
    end: string | null;
  };
  summary: { employees: number; planned_hours: number | null; start: string | null; end: string | null };
  trend: { month: number; label: string; has_data: boolean; planned_hours: number | null }[];
  months: { key: number; label: string }[];
  employees: {
    key: string;
    code: string;
    label: string;
    name: string;
    grade: string | null;
    capability: string | null;
    location: string | null;
    employment_type: string | null;
    total: number | null;
    cells: { month: number; state: "hours" | "dash" | "blank"; hours: number | null }[];
  }[];
}
