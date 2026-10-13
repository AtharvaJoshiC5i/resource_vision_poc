import {
  RESOURCE_DIMENSION_ORDER,
} from "../constants/resourceDimensions";

import type { ResourceDimension, ResourceFilters } from "../types/resourceFilters";

export interface DimensionDrillCrumb {
  dimension: ResourceDimension;
  value: string;
}

export function getNextDrillDimension(
  dimension: ResourceDimension,
): ResourceDimension | null {
  const index = RESOURCE_DIMENSION_ORDER.indexOf(dimension);

  if (index < 0 || index >= RESOURCE_DIMENSION_ORDER.length - 1) {
    return null;
  }

  return RESOURCE_DIMENSION_ORDER[index + 1];
}

export function buildDrillPathFromFilters(
  filters: ResourceFilters,
): DimensionDrillCrumb[] {
  const path: DimensionDrillCrumb[] = [];

  for (const dimension of RESOURCE_DIMENSION_ORDER) {
    const values = filters[dimension];

    if (values.length === 1) {
      path.push({
        dimension,
        value: values[0],
      });
      continue;
    }

    break;
  }

  return path;
}

export function applyDrillPathToFilters(
  filters: ResourceFilters,
  path: DimensionDrillCrumb[],
): ResourceFilters {
  const next: ResourceFilters = {
    ...filters,
  };

  for (const dimension of RESOURCE_DIMENSION_ORDER) {
    const crumb = path.find((item) => item.dimension === dimension);

    next[dimension] = crumb !== undefined ? [crumb.value] : [];
  }

  return next;
}

export function drillIntoDimension(
  filters: ResourceFilters,
  currentDimension: ResourceDimension,
  value: string,
): {
  filters: ResourceFilters;
  nextDimension: ResourceDimension | null;
} {
  const currentIndex = RESOURCE_DIMENSION_ORDER.indexOf(currentDimension);

  const basePath = buildDrillPathFromFilters(filters).filter(
    (crumb) =>
      RESOURCE_DIMENSION_ORDER.indexOf(crumb.dimension) < currentIndex,
  );

  const path: DimensionDrillCrumb[] = [
    ...basePath,
    {
      dimension: currentDimension,
      value,
    },
  ];

  return {
    filters: applyDrillPathToFilters(filters, path),
    nextDimension: getNextDrillDimension(currentDimension),
  };
}

export function drillToBreadcrumbIndex(
  filters: ResourceFilters,
  breadcrumbIndex: number,
): {
  filters: ResourceFilters;
  groupBy: ResourceDimension;
} {
  if (breadcrumbIndex < 0) {
    return {
      filters: applyDrillPathToFilters(filters, []),
      groupBy: RESOURCE_DIMENSION_ORDER[0],
    };
  }

  const path = buildDrillPathFromFilters(filters).slice(0, breadcrumbIndex + 1);
  const last = path[path.length - 1];
  const nextDimension =
    last === undefined ? RESOURCE_DIMENSION_ORDER[0] : getNextDrillDimension(last.dimension);

  return {
    filters: applyDrillPathToFilters(filters, path),
    groupBy: nextDimension ?? last.dimension,
  };
}
