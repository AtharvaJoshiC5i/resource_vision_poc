import type { ProjectListRow } from "../types/projectAvailability";

import type {
  ProjectFilterOption,
  ProjectFilterOptions,
  ProjectFilters,
  SupportedProjectDimensions,
} from "../types/projectFilters";

interface ProjectFilterContext {
  focusMonth: string;
  horizonMonths: string[];
}

function normalizeSearch(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function getMonthStart(monthKey: string): string {
  return `${monthKey}-01`;
}

function getMonthEnd(monthKey: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);

  if (match === null) {
    return `${monthKey}-31`;
  }

  const year = Number(match[1]);

  const month = Number(match[2]);

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return `${match[1]}-${match[2]}-${String(lastDay).padStart(2, "0")}`;
}

function normalizeDate(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());

  if (match === null) {
    return null;
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

function matchesSearch(row: ProjectListRow, search: string): boolean {
  const query = normalizeSearch(search);

  if (query === "") {
    return true;
  }

  return (
    row.projectName.toLocaleLowerCase().includes(query) ||
    row.proposalNumber.toLocaleLowerCase().includes(query)
  );
}

function matchesMultiSelect(
  value: string | undefined,
  selected: string[],
): boolean {
  if (selected.length === 0) {
    return true;
  }

  if (value === undefined) {
    return false;
  }

  return selected.includes(value);
}

function matchesCoverage(
  row: ProjectListRow,
  coverage: ProjectFilters["resourceCoverage"],
): boolean {
  switch (coverage) {
    case "ALL":
      return true;

    case "ASSIGNED":
      return row.resourceCount > 0;

    case "UNASSIGNED":
      return row.resourceCount === 0;
  }
}

function matchesActivity(
  row: ProjectListRow,
  activity: ProjectFilters["focusMonthActivity"],
): boolean {
  switch (activity) {
    case "ALL":
      return true;

    case "HAS_EFFORT":
      return row.focusMonthEffort > 0;

    case "NO_EFFORT":
      return row.focusMonthEffort === 0;
  }
}

function matchesTimeline(
  row: ProjectListRow,
  timeline: ProjectFilters["timeline"],
  context: ProjectFilterContext,
): boolean {
  if (timeline === "ALL") {
    return true;
  }

  const start = normalizeDate(row.startDate);

  const end = normalizeDate(row.endDate);

  if (start === null || end === null) {
    return false;
  }

  const focusStart = getMonthStart(context.focusMonth);

  const focusEnd = getMonthEnd(context.focusMonth);

  const firstHorizonMonth = context.horizonMonths[0];

  const lastHorizonMonth =
    context.horizonMonths[context.horizonMonths.length - 1];

  if (firstHorizonMonth === undefined || lastHorizonMonth === undefined) {
    return false;
  }

  const horizonStart = getMonthStart(firstHorizonMonth);

  const horizonEnd = getMonthEnd(lastHorizonMonth);

  switch (timeline) {
    case "ACTIVE_IN_FOCUS_MONTH":
      return start <= focusEnd && end >= focusStart;

    case "STARTING_IN_HORIZON":
      return start >= horizonStart && start <= horizonEnd;

    case "ENDING_IN_HORIZON":
      return end >= horizonStart && end <= horizonEnd;

    case "COMPLETED_BEFORE_FOCUS_MONTH":
      return end < focusStart;
  }
}

export function filterProjectRows(
  rows: ProjectListRow[],
  filters: ProjectFilters,
  context: ProjectFilterContext,
): ProjectListRow[] {
  return rows.filter(
    (row) =>
      matchesSearch(row, filters.search) &&
      matchesMultiSelect(row.projectStatus, filters.statuses) &&
      matchesMultiSelect(row.primaryCapability, filters.primaryCapabilities) &&
      matchesMultiSelect(
        row.secondaryCapability,
        filters.secondaryCapabilities,
      ) &&
      matchesMultiSelect(row.department, filters.departments) &&
      matchesMultiSelect(row.location, filters.locations) &&
      matchesCoverage(row, filters.resourceCoverage) &&
      matchesTimeline(row, filters.timeline, context) &&
      matchesActivity(row, filters.focusMonthActivity),
  );
}

function buildOptions(values: (string | undefined)[]): ProjectFilterOption[] {
  const counts = new Map<string, number>();

  for (const value of values) {
    if (value === undefined || value.trim() === "") {
      continue;
    }

    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([value, count]) => ({
      value,
      label: value,
      count,
    }))
    .sort((left, right) =>
      left.label.localeCompare(right.label, undefined, {
        numeric: true,
      }),
    );
}

export function getProjectFilterOptions(
  rows: ProjectListRow[],
): ProjectFilterOptions {
  return {
    statuses: buildOptions(rows.map((row) => row.projectStatus)),

    primaryCapabilities: buildOptions(rows.map((row) => row.primaryCapability)),

    secondaryCapabilities: buildOptions(
      rows.map((row) => row.secondaryCapability),
    ),

    departments: buildOptions(rows.map((row) => row.department)),

    locations: buildOptions(rows.map((row) => row.location)),
  };
}

export function getSupportedProjectDimensions(
  rows: ProjectListRow[],
): SupportedProjectDimensions {
  return {
    primaryCapability: rows.some((row) => row.primaryCapability !== undefined),

    secondaryCapability: rows.some(
      (row) => row.secondaryCapability !== undefined,
    ),

    department: rows.some((row) => row.department !== undefined),

    location: rows.some((row) => row.location !== undefined),
  };
}

export function getActiveProjectFilterCount(filters: ProjectFilters): number {
  return (
    (filters.search.trim() !== "" ? 1 : 0) +
    filters.statuses.length +
    filters.primaryCapabilities.length +
    filters.secondaryCapabilities.length +
    filters.departments.length +
    filters.locations.length +
    (filters.resourceCoverage !== "ALL" ? 1 : 0) +
    (filters.timeline !== "ALL" ? 1 : 0) +
    (filters.focusMonthActivity !== "ALL" ? 1 : 0)
  );
}

export function getFilteredCoverageSummary(rows: ProjectListRow[]) {
  return {
    total: rows.length,

    assigned: rows.filter((row) => row.resourceCount > 0).length,

    unassigned: rows.filter((row) => row.resourceCount === 0).length,
  };
}
