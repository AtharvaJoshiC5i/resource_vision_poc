/** Min height hint only: no max clamp (page scroll shows full tables). */
export const PANEL_SCROLL_MIN = "min-h-[12rem]";

/** Shared viewport height for team table and trend chart on project detail (side by side on xl). */
export const PROJECT_WORK_VIEWPORT =
  "h-[max(15rem,min(19.5rem,36dvh))] max-h-[max(15rem,min(19.5rem,36dvh))]";

export const PROJECT_TEAM_VIEWPORT =
  "max-h-[min(32rem,70dvh)] max-md:max-h-none xl:h-[max(15rem,min(19.5rem,36dvh))] xl:max-h-[max(15rem,min(19.5rem,36dvh))]";

/** Shared scroll region when Projects and Availability sit side by side on employee detail. */
export const EMPLOYEE_WORK_PANEL_SCROLL =
  "overflow-x-auto xl:max-h-[min(22rem,42dvh)] xl:overflow-y-auto";