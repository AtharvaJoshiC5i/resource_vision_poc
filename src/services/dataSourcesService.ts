import { BriefcaseBusiness, CalendarClock, History, Users } from "lucide-react";

import type { DataSourceSummary, DataStatusRow } from "../types/dataSources";

import { capacityConfig, famstack, projectTrack, zinghr } from "../data";

export function getDataSourceSummary(): DataSourceSummary[] {
  return [
    {
      id: "zinghr",

      name: "ZingHR",

      role: "Employee Master",

      question: "WHO do we have?",

      description:
        "Employee information used to establish resource identity and organizational dimensions.",

      recordCount: zinghr.length,

      recordLabel: zinghr.length === 1 ? "employee" : "employees",

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

      description:
        "Historical employee effort used to understand actual utilization.",

      recordCount: famstack.length,

      recordLabel: famstack.length === 1 ? "record" : "records",

      period: "Jan–Aug 2026",

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

      description:
        "Monthly planned project effort used to understand current and future utilization.",

      recordCount: projectTrack.length,

      recordLabel: projectTrack.length === 1 ? "record" : "records",

      period: "Sep–Dec 2026",

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

      recordCount: capacityConfig.length,

      recordLabel: capacityConfig.length === 1 ? "record" : "records",

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

export function getDataStatusRows(): DataStatusRow[] {
  return [
    {
      source: "ZingHR",
      purpose: "Employee master",
      pocData: "Synthetic",
      productionIntegration: "Integration pending",
    },

    {
      source: "Famstack",
      purpose: "Historical actuals",
      pocData: "Synthetic",
      productionIntegration: "Integration pending",
    },

    {
      source: "Project Track",
      purpose: "Current/future planned effort",
      pocData: "Synthetic/schema-aligned POC dataset",
      productionIntegration: "Integration pending",
    },

    {
      source: "Capacity Config",
      purpose: "Monthly capacity assumption",
      pocData: "POC configuration",
      productionIntegration: "Business validation required",
    },
  ];
}
