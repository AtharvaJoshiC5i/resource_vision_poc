import type { ResourceDimension } from "../types/resourceFilters";

export const RESOURCE_DIMENSION_ORDER: ResourceDimension[] = [
  "primaryCapability",
  "secondaryCapability",
  "department",
  "grade",
  "country",
  "location",
];

export const RESOURCE_DIMENSION_LABELS: Record<ResourceDimension, string> = {
  primaryCapability: "Primary Capability",
  secondaryCapability: "Secondary Capability",
  department: "Department",
  grade: "Grade",
  location: "Location",
  country: "Country",
};

export const RESOURCE_DIMENSION_SHORT_LABELS: Record<ResourceDimension, string> =
  {
    primaryCapability: "Primary",
    secondaryCapability: "Secondary",
    department: "Department",
    grade: "Grade",
    location: "Location",
    country: "Country",
  };
