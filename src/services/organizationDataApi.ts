import type { FamstackRecord } from "../types/famstack";
import type { PlanningHorizon } from "../types/planningHorizon";
import type { ProjectTrackRecord } from "../types/projectTrack";
import type { ZingHREmployee } from "../types/zinghr";

import { toCanonicalMonthKey } from "./monthService";

export interface OrganizationDataApiResponse {
  source: string;
  planning: PlanningHorizon;
  counts: Record<string, number>;
  famstack: FamstackRecord[];
  projectTrack: ProjectTrackRecord[];
  zinghr: ZingHREmployee[];
}

const DEFAULT_API_BASE = "/api";

function getApiBase(): string {
  const configured = import.meta.env.VITE_RESOURCE_VISION_API_URL;

  if (typeof configured === "string" && configured.trim() !== "") {
    return configured.replace(/\/$/, "");
  }

  return DEFAULT_API_BASE;
}

export async function fetchOrganizationResourceVisionData(): Promise<OrganizationDataApiResponse> {
  const response = await fetch(`${getApiBase()}/data/resource-vision`, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;

    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail !== undefined && body.detail.trim() !== "") {
        detail = body.detail;
      }
    } catch {
      // ignore JSON parse errors
    }

    throw new Error(detail);
  }

  const payload = (await response.json()) as OrganizationDataApiResponse;

  const famstack = payload.famstack.map((record) => ({
    ...record,
    month_key: toCanonicalMonthKey(record.month_key),
  }));

  const projectTrack = payload.projectTrack.map((record) => ({
    ...record,
    month_key: toCanonicalMonthKey(record.month_key),
  }));

  const shaped = {
    ...payload,
    famstack,
    projectTrack,
  };

  const planning =
    payload.planning !== undefined
      ? {
          ...payload.planning,
          currentMonth: toCanonicalMonthKey(payload.planning.currentMonth),
          monthKeys: payload.planning.monthKeys.map(toCanonicalMonthKey),
          famstackMonths: payload.planning.famstackMonths.map(
            toCanonicalMonthKey,
          ),
          projectTrackMonths: payload.planning.projectTrackMonths.map(
            toCanonicalMonthKey,
          ),
        }
      : inferPlanningHorizon(shaped);

  return {
    ...shaped,
    planning,
  };
}

function inferPlanningHorizon(
  payload: Omit<OrganizationDataApiResponse, "planning">,
): PlanningHorizon {
  const famstackMonths = [
    ...new Set(payload.famstack.map((record) => record.month_key)),
  ].sort();

  const projectTrackMonths = [
    ...new Set(payload.projectTrack.map((record) => record.month_key)),
  ].sort();

  const monthKeys = [
    ...new Set([...famstackMonths, ...projectTrackMonths]),
  ].sort();

  const currentMonth =
    projectTrackMonths[0] ?? famstackMonths[famstackMonths.length - 1] ?? "2026-09";

  return {
    currentMonth,
    monthKeys,
    famstackMonths,
    projectTrackMonths,
  };
}

export async function pingOrganizationDatabase(): Promise<boolean> {
  const response = await fetch(`${getApiBase()}/database/status`);

  return response.ok;
}
