import type { LucideIcon } from "lucide-react";

export type DataSourceKind = "enterprise" | "configuration";

export interface DataSourceSummary {
  id: "zinghr" | "famstack" | "project-track" | "capacity-config";

  name: string;
  role: string;
  question?: string;
  description: string;

  recordCount: number;
  recordLabel: string;

  period?: string;

  fields: string[];

  kind: DataSourceKind;

  icon: LucideIcon;
}

export interface DataStatusRow {
  source: string;
  purpose: string;
  pocData: string;
  productionIntegration: string;
}
