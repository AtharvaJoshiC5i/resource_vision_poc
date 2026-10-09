/**
 * Resource Vision 2.0
 *
 * Shared configuration for time-aware
 * availability and resource planning.
 *
 * These values are business configuration,
 * not resource availability calculations.
 */

/**
 * Projects starting within this number of
 * calendar days receive urgent planning
 * priority.
 *
 * This includes projects starting today.
 *
 * The value can be revised after business
 * validation with Amit and Anees.
 */
export const RESOURCE_PRIORITY_WINDOW_DAYS = 15;

/**
 * The project urgency window uses calendar
 * days rather than working days.
 *
 * Release availability continues to use
 * the existing monthly capacity calendar.
 */
export const RESOURCE_PRIORITY_DAY_BASIS = "CALENDAR_DAYS" as const;

/**
 * Project planning priority is independent
 * of the project's lifecycle status.
 */
export const PROJECT_PLANNING_PRIORITIES = [
  "URGENT",
  "UPCOMING",
  "FUTURE",
] as const;

export type ProjectPlanningPriority =
  (typeof PROJECT_PLANNING_PRIORITIES)[number];

/**
 * Timing compatibility for future project
 * requirements.
 *
 * This is not a recommendation, reservation,
 * or resource assignment status.
 */
export const RESOURCE_TIMING_STATUSES = [
  "AVAILABLE_BY_START",
  "PARTIALLY_AVAILABLE_BY_START",
  "NOT_AVAILABLE_BY_START",
] as const;

export type ResourceTimingStatus = (typeof RESOURCE_TIMING_STATUSES)[number];

/**
 * Resource release classification.
 *
 * A partial release means that available
 * capacity increased but the resource
 * remains committed to some allocation.
 *
 * A full release means that the resource
 * has become fully available according to
 * the canonical Availability Engine.
 */
export const RESOURCE_RELEASE_TYPES = [
  "PARTIAL_RELEASE",
  "FULL_RELEASE",
] as const;

export type ResourceReleaseType = (typeof RESOURCE_RELEASE_TYPES)[number];
