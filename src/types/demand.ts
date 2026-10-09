export interface UnassignedDemandRecord {
  project_id: string;
  proposal_number: string;
  project_name: string;

  month_key: string;

  primary_capability: string;
  secondary_capability: string;
  department: string;
  grade: string;
  location: string;
  country: string;

  effort_hours: number;
}
