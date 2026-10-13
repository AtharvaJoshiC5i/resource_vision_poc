import {
  BarChart3,
  BriefcaseBusiness,
  Database,
  LayoutDashboard,
  Users,
} from "lucide-react";

import type {
  LucideIcon,
} from "lucide-react";

export interface NavigationItem {
  label: string;

  path: string;

  icon: LucideIcon;

  /**
   * Used for nested routes.
   *
   * Example:
   * /resources/RV-E001
   * should keep Resources highlighted.
   */
  matchPrefix?: string;
}

export interface NavigationSection {
  label: string;

  items: NavigationItem[];
}

export const navigationSections: NavigationSection[] = [
  {
    label: "WORKSPACE",

    items: [
      {
        label: "Overview",
        path: "/",
        icon: LayoutDashboard,
      },

      {
        label: "Availability",
        path: "/availability",
        icon: BarChart3,
        matchPrefix: "/availability",
      },

      {
        label: "Resources",
        path: "/resources",
        icon: Users,
        matchPrefix: "/resources",
      },

      {
        label: "Projects",
        path: "/projects",
        icon: BriefcaseBusiness,
        matchPrefix: "/projects",
      },
    ],
  },

  {
    label: "SYSTEM",

    items: [
      {
        label: "Data Sources",
        path: "/data-sources",
        icon: Database,
        matchPrefix: "/data-sources",
      },
    ],
  },
];

/**
 * Centralized page copy.
 *
 * IMPORTANT:
 * Existing Resource Vision pages access metadata
 * using named keys such as:
 *
 * pageMetadata.overview.title
 *
 * Therefore these keys must remain named objects
 * rather than URL-keyed entries.
 */
export const pageMetadata = {
  overview: {
    title: "Overview",

    description:
      "Organization-wide capacity, utilization, and unassigned demand at a glance.",
  },

  availability: {
    title: "Resource Availability",

    description:
      "See how many hours each person can take on, month by month, after planned project effort.",
  },

  resources: {
    title: "Resources",

    description:
      "Browse employees and compare availability across the planning horizon.",
  },

  resourceDetail: {
    title: "Resource Detail",

    description:
      "Employee capacity, project commitments, and forward availability.",
  },

  projects: {
    title: "Projects",

    description:
      "Project allocations and assigned resources across the planning horizon.",
  },

  projectDetail: {
    title: "Project Detail",

    description:
      "Project effort and assigned resources across the planning horizon.",
  },

  dataSources: {
    title: "Data Sources",

    description:
      "How Resource Vision combines employee, historical utilization, and project planning data.",
  },
} as const;