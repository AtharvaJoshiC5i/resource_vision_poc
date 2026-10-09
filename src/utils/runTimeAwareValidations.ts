import { validateTimeAwareAvailability } from "./validateTimeAwareAvailability";

import { validateProjectPlanningPriority } from "./validateProjectPlanningPriority";

import { validateAvailabilityTiming } from "./validateAvailabilityTiming";

import { validateReleaseIntegration } from "./validateReleaseIntegration";

import { validateResourceReleaseScenarios } from "./validateResourceReleaseScenarios";

import { validateProjectStartCompatibility } from "./validateProjectStartCompatibility";

export interface ValidationResult {
  name: string;
  passed: number;
  failed: number;
  errors: string[];
  warnings: string[];
}

export interface TimeAwareValidationSummary {
  isValid: boolean;
  totalPassed: number;
  totalFailed: number;
  results: ValidationResult[];
}

interface ValidationReport {
  isValid: boolean;
  passed: number;
  failed: number;
  errors: string[];
  warnings?: string[];
}

interface ValidationDefinition {
  name: string;
  run: () => ValidationReport;
}

const validations: ValidationDefinition[] = [
  {
    name: "Time-Aware Availability",
    run: validateTimeAwareAvailability,
  },
  {
    name: "Project Planning Priority",
    run: validateProjectPlanningPriority,
  },
  {
    name: "Availability Timing",
    run: validateAvailabilityTiming,
  },
  {
    name: "Release Integration",
    run: validateReleaseIntegration,
  },
  {
    name: "Resource Release Scenarios",
    run: validateResourceReleaseScenarios,
  },
  {
    name: "Project Start Compatibility",
    run: validateProjectStartCompatibility,
  },
];

export function runTimeAwareValidations(): TimeAwareValidationSummary {
  const results: ValidationResult[] = [];

  for (const validation of validations) {
    try {
      const report = validation.run();

      results.push({
        name: validation.name,
        passed: report.passed,
        failed: report.failed,
        errors: [...report.errors],
        warnings: [...(report.warnings ?? [])],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      results.push({
        name: validation.name,
        passed: 0,
        failed: 1,
        errors: [`Validation could not complete: ${message}`],
        warnings: [],
      });
    }
  }

  const totalPassed = results.reduce((sum, result) => sum + result.passed, 0);

  const totalFailed = results.reduce((sum, result) => sum + result.failed, 0);

  return {
    isValid: totalFailed === 0,
    totalPassed,
    totalFailed,
    results,
  };
}

export function logTimeAwareValidationSummary(): void {
  const summary = runTimeAwareValidations();

  console.group("[Resource Vision] Time-Aware Availability Validation");

  for (const result of summary.results) {
    const successful = result.failed === 0;

    const message =
      `${result.name}: ` + `${result.passed} passed, ${result.failed} failed`;

    if (successful) {
      console.info(message);
    } else {
      console.error(message);
    }

    for (const error of result.errors) {
      console.error(`[${result.name}] ${error}`);
    }

    for (const warning of result.warnings) {
      console.warn(`[${result.name}] ${warning}`);
    }
  }

  if (summary.isValid) {
    console.info(`All ${summary.totalPassed} checks passed.`);
  } else {
    console.error(
      `${summary.totalFailed} validation checks failed. ` +
        `${summary.totalPassed} passed.`,
    );
  }

  console.groupEnd();
}
