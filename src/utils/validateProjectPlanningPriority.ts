import { getProjectPlanningPriority } from "../services/projectPlanningPriorityService";

import { RESOURCE_PRIORITY_WINDOW_DAYS } from "../constants/resourcePlanning";

export interface PriorityValidationReport {
  isValid: boolean;
  passed: number;
  failed: number;
  errors: string[];
}

function makeProject(startDate: string) {
  return {
    projectId: "VALIDATION_PROJECT",
    projectName: "Validation Project",
    startDate,
  };
}

export function validateProjectPlanningPriority(): PriorityValidationReport {
  const errors: string[] = [];
  let passed = 0;

  const today = new Date(2026, 9, 6);
  const horizonEnd = "2027-03-31";

  function check(name: string, condition: boolean): void {
    if (condition) {
      passed += 1;
    } else {
      errors.push(name);
    }
  }

  const urgent = getProjectPlanningPriority(
    makeProject("2026-10-15"),
    today,
    horizonEnd,
  );

  check(
    "Project starting in 9 days is urgent",
    urgent.priority === "URGENT" && urgent.daysUntilStart === 9,
  );

  const boundary = getProjectPlanningPriority(
    makeProject("2026-10-21"),
    today,
    horizonEnd,
  );

  check(
    "Project starting in exactly 15 days is urgent",
    boundary.priority === "URGENT" && boundary.daysUntilStart === 15,
  );

  const outsideWindow = getProjectPlanningPriority(
    makeProject("2026-10-22"),
    today,
    horizonEnd,
  );

  check(
    "Project starting in 16 days is upcoming",
    outsideWindow.priority === "UPCOMING",
  );

  const future = getProjectPlanningPriority(
    makeProject("2027-04-15"),
    today,
    horizonEnd,
  );

  check("Project beyond horizon is future", future.priority === "FUTURE");

  const started = getProjectPlanningPriority(
    makeProject("2026-09-01"),
    today,
    horizonEnd,
  );

  check(
    "Already-started project is not urgent",
    started.priority === "STARTED" && started.isAlreadyStarted,
  );

  const startsToday = getProjectPlanningPriority(
    makeProject("2026-10-06"),
    today,
    horizonEnd,
  );

  check(
    "Project starting today is urgent",
    startsToday.priority === "URGENT" && startsToday.daysUntilStart === 0,
  );

  check(
    "Priority window is centralized",
    urgent.priorityWindowDays === RESOURCE_PRIORITY_WINDOW_DAYS,
  );

  return {
    isValid: errors.length === 0,
    passed,
    failed: errors.length,
    errors,
  };
}

export function logProjectPlanningPriorityValidation(): void {
  const report = validateProjectPlanningPriority();

  if (report.isValid) {
    console.info(
      `[Resource Vision] Project planning priority: ${report.passed} checks passed.`,
    );
  } else {
    console.error(
      `[Resource Vision] Project planning priority: ${report.failed} checks failed.`,
    );

    for (const error of report.errors) {
      console.error(`[Resource Vision] ${error}`);
    }
  }
}
