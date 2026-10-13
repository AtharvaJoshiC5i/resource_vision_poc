import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import capacityConfigData from "../data/capacityConfig.json";

import type { CapacityConfigRecord } from "../types/capacity";
import type { FamstackRecord } from "../types/famstack";
import type { ProjectTrackRecord } from "../types/projectTrack";
import type { ZingHREmployee } from "../types/zinghr";

import { buildResourceVisionData } from "../services/buildResourceVisionData";

import type { ResourceVisionDataBundle } from "../services/buildResourceVisionData";

import { safeBuildResourceVisionData } from "../services/safeBuildResourceVisionData";

import { fetchOrganizationResourceVisionData } from "../services/organizationDataApi";

import { setOrganizationPlanningHorizon } from "../services/planningHorizonRuntime";

import type { PlanningHorizon } from "../types/planningHorizon";

import {
  mockResourceVisionBundle,
} from "../data/mockResourceVisionBundle";

import type { ResourceDataMode } from "../types/resourceDataMode";

export type { ResourceDataMode };

const STORAGE_KEY = "resource-vision:data-mode";

interface ResourceDataContextValue {
  mode: ResourceDataMode;
  setMode: (mode: ResourceDataMode) => void;
  loading: boolean;
  error: string | null;
  dataWarnings: string[];
  isOrganizationReady: boolean;
  refresh: () => Promise<void>;
  bundle: ResourceVisionDataBundle;
  capacityConfig: CapacityConfigRecord[];
  famstack: FamstackRecord[];
  projectTrack: ProjectTrackRecord[];
  zinghr: ZingHREmployee[];
  availabilityQueryContext: ResourceVisionDataBundle["availabilityQueryContext"];
  resourceMonthlyRecords: ResourceVisionDataBundle["resourceMonthlyRecords"];
  unassignedDemand: ResourceVisionDataBundle["unassignedDemand"];
  planningHorizon: PlanningHorizon | null;
}

const ResourceDataContext = createContext<ResourceDataContextValue | null>(
  null,
);

function readStoredMode(): ResourceDataMode {
  const stored = localStorage.getItem(STORAGE_KEY);

  return stored === "organization" ? "organization" : "mock";
}

export function ResourceDataProvider({ children }: { children: ReactNode }) {
  const capacityConfig = capacityConfigData as CapacityConfigRecord[];

  const [mode, setModeState] = useState<ResourceDataMode>(() =>
    readStoredMode(),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [organizationSources, setOrganizationSources] = useState<
    Pick<ResourceVisionDataBundle, "famstack" | "projectTrack" | "zinghr"> | null
  >(null);

  const setMode = useCallback((nextMode: ResourceDataMode) => {
    setModeState(nextMode);
    localStorage.setItem(STORAGE_KEY, nextMode);
    setError(null);

    if (nextMode === "mock") {
      setOrganizationPlanningHorizon(null);
    }
  }, []);

  const [planningHorizon, setPlanningHorizon] =
    useState<PlanningHorizon | null>(null);

  const loadOrganizationData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const payload = await fetchOrganizationResourceVisionData();

      setOrganizationPlanningHorizon(payload.planning);
      setPlanningHorizon(payload.planning);

      setOrganizationSources({
        famstack: payload.famstack,
        projectTrack: payload.projectTrack,
        zinghr: payload.zinghr,
      });
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Failed to load organization data.";

      setError(message);
      setOrganizationPlanningHorizon(null);
      setPlanningHorizon(null);
      setOrganizationSources(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (mode === "organization") {
      await loadOrganizationData();
    }
  }, [loadOrganizationData, mode]);

  useEffect(() => {
    if (mode !== "organization") {
      return;
    }

    void loadOrganizationData();
  }, [loadOrganizationData, mode]);

  const { bundle, dataWarnings } = useMemo(() => {
    if (mode === "mock") {
      return { bundle: mockResourceVisionBundle, dataWarnings: [] as string[] };
    }

    if (organizationSources === null) {
      return {
        bundle: buildResourceVisionData({
          capacityConfig,
          famstack: [],
          projectTrack: [],
          zinghr: [],
        }),
        dataWarnings: [] as string[],
      };
    }

    const result = safeBuildResourceVisionData(
      {
        capacityConfig,
        famstack: organizationSources.famstack,
        projectTrack: organizationSources.projectTrack,
        zinghr: organizationSources.zinghr,
      },
      { expandWorkCalendar: true },
    );

    return {
      bundle: result.bundle,
      dataWarnings: result.warnings,
    };
  }, [capacityConfig, mode, organizationSources]);

  const isOrganizationReady =
    mode === "mock" || organizationSources !== null || error !== null;

  const value = useMemo<ResourceDataContextValue>(
    () => ({
      mode,
      setMode,
      loading,
      error,
      dataWarnings,
      isOrganizationReady,
      refresh,
      bundle,
      capacityConfig,
      famstack: bundle.famstack,
      projectTrack: bundle.projectTrack,
      zinghr: bundle.zinghr,
      availabilityQueryContext: bundle.availabilityQueryContext,
      resourceMonthlyRecords: bundle.resourceMonthlyRecords,
      unassignedDemand: bundle.unassignedDemand,
      planningHorizon: mode === "organization" ? planningHorizon : null,
    }),
    [
      bundle,
      capacityConfig,
      dataWarnings,
      error,
      isOrganizationReady,
      loading,
      mode,
      planningHorizon,
      refresh,
      setMode,
    ],
  );

  return (
    <ResourceDataContext.Provider value={value}>
      {children}
    </ResourceDataContext.Provider>
  );
}

export function useResourceData(): ResourceDataContextValue {
  const context = useContext(ResourceDataContext);

  if (context === null) {
    throw new Error(
      "useResourceData must be used within a ResourceDataProvider.",
    );
  }

  return context;
}
