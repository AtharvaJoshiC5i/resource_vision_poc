import type { ResourceVisionDataBundle, ResourceVisionSourceInput } from "./buildResourceVisionData";

import { buildResourceVisionData } from "./buildResourceVisionData";

import { normalizeEmployees } from "./normalization/employeeNormalizationService";

import { expandCapacityConfigForOrganizationData } from "./workCalendarExpansionService";

export interface SafeBuildResourceVisionDataResult {
  bundle: ResourceVisionDataBundle;
  warnings: string[];
  recoveredFromError: boolean;
}

export function safeBuildResourceVisionData(
  input: ResourceVisionSourceInput,
  options: { expandWorkCalendar: boolean },
): SafeBuildResourceVisionDataResult {
  const warnings: string[] = [];
  const employees = normalizeEmployees(input.zinghr);

  let capacityConfig = input.capacityConfig;

  if (options.expandWorkCalendar) {
    const expansion = expandCapacityConfigForOrganizationData({
      baseConfig: capacityConfig,
      employees,
      famstack: input.famstack,
      projectTrack: input.projectTrack,
    });

    capacityConfig = expansion.records;
    warnings.push(...expansion.warnings);
  }

  const preparedInput: ResourceVisionSourceInput = {
    ...input,
    capacityConfig,
  };

  try {
    return {
      bundle: buildResourceVisionData(preparedInput),
      warnings,
      recoveredFromError: false,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown data processing error.";

    warnings.push(
      `Availability calculation used fallbacks after a data issue: ${message}`,
    );

    try {
      return {
        bundle: buildResourceVisionData({
          capacityConfig,
          famstack: [],
          projectTrack: [],
          zinghr: [],
        }),
        warnings,
        recoveredFromError: true,
      };
    } catch {
      return {
        bundle: buildResourceVisionData({
          capacityConfig: input.capacityConfig,
          famstack: [],
          projectTrack: [],
          zinghr: [],
        }),
        warnings: [
          ...warnings,
          "Showing an empty workspace because organization data could not be processed.",
        ],
        recoveredFromError: true,
      };
    }
  }
}
