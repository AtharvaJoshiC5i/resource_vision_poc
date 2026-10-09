import type { UnassignedDemandRecord } from "../types/demand";

import type { ResourceMonthlyRecord } from "../types/resourceMonthly";

export interface ResourceDiagnostics {
  normalizedRecords: number;

  historicalRecords: number;

  plannedRecords: number;

  unassignedDemandRecords: number;

  fullyAvailableRecords: number;

  partiallyAvailableRecords: number;

  fullyAllocatedRecords: number;

  overAllocatedRecords: number;
}

export function getResourceDiagnostics(
  records: ResourceMonthlyRecord[],

  unassignedDemand: UnassignedDemandRecord[],
): ResourceDiagnostics {
  return {
    normalizedRecords: records.length,

    historicalRecords: records.filter((record) => record.source === "FAMSTACK")
      .length,

    plannedRecords: records.filter(
      (record) => record.source === "PROJECT_TRACK",
    ).length,

    unassignedDemandRecords: unassignedDemand.length,

    fullyAvailableRecords: records.filter(
      (record) => record.availability_status === "AVAILABLE",
    ).length,

    partiallyAvailableRecords: records.filter(
      (record) => record.availability_status === "PARTIALLY_AVAILABLE",
    ).length,

    fullyAllocatedRecords: records.filter(
      (record) => record.availability_status === "FULLY_ALLOCATED",
    ).length,

    overAllocatedRecords: records.filter(
      (record) => record.availability_status === "OVER_ALLOCATED",
    ).length,
  };
}

export function logResourceDiagnostics(diagnostics: ResourceDiagnostics): void {
  console.info("[Resource Vision] Availability Engine");

  console.info(
    `[Resource Vision] Normalized resource-month records: ${diagnostics.normalizedRecords}`,
  );

  console.info(
    `[Resource Vision] Historical records: ${diagnostics.historicalRecords}`,
  );

  console.info(
    `[Resource Vision] Planned records: ${diagnostics.plannedRecords}`,
  );

  console.info(
    `[Resource Vision] Unassigned demand records: ${diagnostics.unassignedDemandRecords}`,
  );

  console.info(
    `[Resource Vision] Fully available records: ${diagnostics.fullyAvailableRecords}`,
  );

  console.info(
    `[Resource Vision] Partially available records: ${diagnostics.partiallyAvailableRecords}`,
  );

  console.info(
    `[Resource Vision] Fully allocated records: ${diagnostics.fullyAllocatedRecords}`,
  );

  console.info(
    `[Resource Vision] Over-allocated records: ${diagnostics.overAllocatedRecords}`,
  );
}
