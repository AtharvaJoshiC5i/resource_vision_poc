import { BriefcaseBusiness, CalendarClock, History, Users } from "lucide-react";

import type { DataSourceSummary, DataStatusRow } from "../types/dataSources";

import type { ResourceDataMode } from "../types/resourceDataMode";

export interface DataSourceCounts {
  zinghr: number;
  famstack: number;
  projectTrack: number;
  capacityConfig: number;
}

export function getDataSourceSummary(
  counts: DataSourceCounts,
  mode: ResourceDataMode = "mock",
): DataSourceSummary[] {
  const isOrganization = mode === "organization";
  const zinghrDescription = isOrganization
    ? "Employee master derived from Project Track and Famstack employee codes."
    : "Employee information used to establish resource identity and organizational dimensions.";

  const famstackDescription = isOrganization
    ? "Historical billable and non-billable effort loaded from Azure SQL."
    : "Historical employee effort used to understand actual utilization.";

  const projectTrackDescription = isOrganization
    ? "Planned project effort loaded from Azure SQL."
    : "Monthly planned project effort used to understand current and future utilization.";

  return [
    {
      id: "zinghr",

      name: "ZingHR",

      role: "Employee Master",

      question: "WHO do we have?",

      description: zinghrDescription,

      recordCount: counts.zinghr,

      recordLabel: counts.zinghr === 1 ? "employee" : "employees",

      fields: [
        "Employee ID",
        "Employee Name",
        "Primary Capability",
        "Secondary Capability",
        "Department",
        "Grade",
        "Location",
        "Country",
        "Employment Status",
        "Joining / Leaving Date",
      ],

      kind: "enterprise",

      icon: Users,
    },

    {
      id: "famstack",

      name: "Famstack",

      role: "Historical Actuals",

      question: "WHAT ACTUALLY HAPPENED?",

      description: famstackDescription,

      recordCount: counts.famstack,

      recordLabel: counts.famstack === 1 ? "record" : "records",

      period: isOrganization ? "From Azure SQL" : "Jan–Aug 2026",

      fields: [
        "Employee ID",
        "Month",
        "Project",
        "Billing Type",
        "Work Category",
        "Actual Effort Hours",
      ],

      kind: "enterprise",

      icon: History,
    },

    {
      id: "project-track",

      name: "Project Track",

      role: "Current & Future Plan",

      question: "WHAT IS PLANNED?",

      description: projectTrackDescription,

      recordCount: counts.projectTrack,

      recordLabel: counts.projectTrack === 1 ? "record" : "records",

      period: isOrganization ? "From Azure SQL" : "Sep–Dec 2026",

      fields: [
        "Proposal Number",
        "Project",
        "Month",
        "Planned Effort",
        "Primary Capability",
        "Secondary Capability",
        "Department",
        "Grade",
        "Location",
        "Country",
        "Employee",
      ],

      kind: "enterprise",

      icon: BriefcaseBusiness,
    },

    {
      id: "capacity-config",

      name: "Capacity Configuration",

      role: "POC Capacity Assumption",

      description:
        "Defines standard monthly capacity using working days and hours per day.",

      recordCount: counts.capacityConfig,

      recordLabel: counts.capacityConfig === 1 ? "record" : "records",

      fields: [
        "Country",
        "Location",
        "Month",
        "Working Days",
        "Hours per Day",
        "Standard Capacity Hours",
      ],

      kind: "configuration",

      icon: CalendarClock,
    },
  ];
}

export function getDataStatusRows(mode: ResourceDataMode = "mock"): DataStatusRow[] {
  const isOrganization = mode === "organization";

  return [
    {
      source: "ZingHR",
      purpose: "Employee master",
      pocData: isOrganization ? "Derived from Azure SQL sources" : "Synthetic",
      productionIntegration: isOrganization
        ? "Live derivation (no ZingHR table in scope)"
        : "Integration pending",
    },

    {
      source: "Famstack",
      purpose: "Historical actuals",
      pocData: isOrganization
        ? "Azure SQL (billable + non-billable)"
        : "Synthetic",
      productionIntegration: isOrganization
        ? "Connected via Resource Vision API"
        : "Integration pending",
    },

    {
      source: "Project Track",
      purpose: "Current/future planned effort",
      pocData: isOrganization
        ? "Azure SQL (project_track_proposals_table)"
        : "Synthetic/schema-aligned POC dataset",
      productionIntegration: isOrganization
        ? "Connected via Resource Vision API"
        : "Integration pending",
    },

    {
      source: "Capacity Config",
      purpose: "Monthly capacity assumption",
      pocData: "POC configuration",
      productionIntegration: "Business validation required",
    },
  ];
}
