export type EmployeeTagging = "TAGGED" | "UNASSIGNED_GRADE_DEMAND";

export type ProjectStatus = "Active" | "Planned";

export type ProjectLifecycleStage = "Delivery" | "Planning";

export type ProjectContractType = "Fixed Price" | "Time & Material";

export interface ProjectTrackRecord {
  project_id: string;
  proposal_number: string;
  project_name: string;
  month_key: string;
  year: number;
  fiscal_year: string;
  fiscal_quarter: string;
  effort_value: number;
  primary_capability: string;
  secondary_capability: string;
  department: string;
  grade: string;
  location: string;
  country: string;
  employee_id: string;
  employee_name: string;
  employee_tagging: EmployeeTagging;
  project_status: ProjectStatus;
  lifecycle_stage: ProjectLifecycleStage;
  contract_type: ProjectContractType;
  start_date: string;
  end_date: string;
}

export interface TaggedProjectTrackRecord extends ProjectTrackRecord {
  employee_tagging: "TAGGED";
  employee_id: string;
  employee_name: string;
}

export interface UnassignedDemandRecord extends ProjectTrackRecord {
  employee_tagging: "UNASSIGNED_GRADE_DEMAND";
  employee_id: "";
  employee_name: "";
}
