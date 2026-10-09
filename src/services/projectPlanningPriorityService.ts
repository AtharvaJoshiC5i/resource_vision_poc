import { RESOURCE_PRIORITY_WINDOW_DAYS } from "../constants/resourcePlanning";

export type ProjectPlanningState = "STARTED" | "URGENT" | "UPCOMING" | "FUTURE";

export interface ProjectPlanningInput {
  projectId: string;
  projectName: string;
  startDate: string;
}

export interface ProjectPlanningPriorityResult {
  projectId: string;
  projectName: string;
  startDate: string;
  priority: ProjectPlanningState;
  daysUntilStart: number;
  priorityWindowDays: number;
  isAlreadyStarted: boolean;
}

const DAY_MS = 86_400_000;

function parseDateOnly(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());

  if (!match) {
    throw new Error(`Invalid project date: ${value}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Invalid project date: ${value}`);
  }

  return timestamp;
}

function getLocalCalendarDay(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getDaysUntilProjectStart(
  startDate: string,
  today: Date = new Date(),
): number {
  return Math.round(
    (parseDateOnly(startDate) - getLocalCalendarDay(today)) / DAY_MS,
  );
}

export function getProjectPlanningPriority(
  project: ProjectPlanningInput,
  today: Date = new Date(),
  planningHorizonEnd?: string,
): ProjectPlanningPriorityResult {
  const daysUntilStart = getDaysUntilProjectStart(project.startDate, today);

  let priority: ProjectPlanningState;

  if (daysUntilStart < 0) {
    priority = "STARTED";
  } else if (daysUntilStart <= RESOURCE_PRIORITY_WINDOW_DAYS) {
    priority = "URGENT";
  } else if (
    planningHorizonEnd === undefined ||
    parseDateOnly(project.startDate) <= parseDateOnly(planningHorizonEnd)
  ) {
    priority = "UPCOMING";
  } else {
    priority = "FUTURE";
  }

  return {
    projectId: project.projectId,
    projectName: project.projectName,
    startDate: project.startDate,
    priority,
    daysUntilStart,
    priorityWindowDays: RESOURCE_PRIORITY_WINDOW_DAYS,
    isAlreadyStarted: daysUntilStart < 0,
  };
}

export function getProjectPlanningPriorityLabel(
  priority: ProjectPlanningState,
): string {
  switch (priority) {
    case "STARTED":
      return "Started";
    case "URGENT":
      return "Urgent";
    case "UPCOMING":
      return "Upcoming";
    case "FUTURE":
      return "Future";
  }
}
