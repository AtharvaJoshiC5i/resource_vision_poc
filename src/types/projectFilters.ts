export type ProjectResourceCoverage =
  | "ALL"
  | "ASSIGNED"
  | "UNASSIGNED";

export type ProjectTimelineFilter =
  | "ALL"
  | "ACTIVE_IN_FOCUS_MONTH"
  | "STARTING_IN_HORIZON"
  | "ENDING_IN_HORIZON"
  | "COMPLETED_BEFORE_FOCUS_MONTH";

export type ProjectFocusMonthActivity =
  | "ALL"
  | "HAS_EFFORT"
  | "NO_EFFORT";

export type ProjectDimension =
  | "primaryCapability"
  | "secondaryCapability"
  | "department"
  | "location";

export interface ProjectFilters {
  search: string;

  statuses: string[];

  primaryCapabilities: string[];
  secondaryCapabilities: string[];
  departments: string[];
  locations: string[];

  resourceCoverage:
    ProjectResourceCoverage;

  timeline:
    ProjectTimelineFilter;

  focusMonthActivity:
    ProjectFocusMonthActivity;
}

export interface ProjectFilterOption {
  value: string;
  label: string;
  count: number;
}

export interface ProjectFilterOptions {
  statuses:
    ProjectFilterOption[];

  primaryCapabilities:
    ProjectFilterOption[];

  secondaryCapabilities:
    ProjectFilterOption[];

  departments:
    ProjectFilterOption[];

  locations:
    ProjectFilterOption[];
}

export interface SupportedProjectDimensions {
  primaryCapability: boolean;
  secondaryCapability: boolean;
  department: boolean;
  location: boolean;
}

export const DEFAULT_PROJECT_FILTERS:
  ProjectFilters = {
    search: "",

    statuses: [],

    primaryCapabilities: [],
    secondaryCapabilities: [],
    departments: [],
    locations: [],

    resourceCoverage: "ALL",

    timeline: "ALL",

    focusMonthActivity: "ALL",
  };