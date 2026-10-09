import type { Employee, EmployeeMonthAvailability } from "../types/domain";

import type {
  ResourceDimension,
  ResourceFilterOption,
  ResourceFilterOptions,
  ResourceFilters,
} from "../types/resourceFilters";

const DIMENSIONS: ResourceDimension[] = [
  "primaryCapability",
  "secondaryCapability",
  "department",
  "grade",
  "location",
  "country",
];

function normalizeSearch(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function normalizeDimensionValue(value: string): string {
  return value.trim();
}

function getEmployeeDimensionValue(
  employee: Employee,
  dimension: ResourceDimension,
): string {
  return normalizeDimensionValue(employee[dimension]);
}

function matchesSelectedValues(
  employeeValue: string,
  selectedValues: string[],
): boolean {
  if (selectedValues.length === 0) {
    return true;
  }

  return selectedValues.includes(employeeValue);
}

function matchesSearch(employee: Employee, search: string): boolean {
  const normalizedSearch = normalizeSearch(search);

  if (normalizedSearch === "") {
    return true;
  }

  return (
    employee.employeeName.toLocaleLowerCase().includes(normalizedSearch) ||
    employee.employeeId.toLocaleLowerCase().includes(normalizedSearch)
  );
}

function matchesDimensions(
  employee: Employee,
  filters: ResourceFilters,
  excludedDimension?: ResourceDimension,
): boolean {
  for (const dimension of DIMENSIONS) {
    if (dimension === excludedDimension) {
      continue;
    }

    if (
      !matchesSelectedValues(
        getEmployeeDimensionValue(employee, dimension),
        filters[dimension],
      )
    ) {
      return false;
    }
  }

  return true;
}

export function filterEmployees(
  employees: Employee[],
  filters: ResourceFilters,
): Employee[] {
  return employees.filter(
    (employee) =>
      matchesSearch(employee, filters.search) &&
      matchesDimensions(employee, filters),
  );
}

export function filterAvailabilityByEmployeePopulation(
  availability: EmployeeMonthAvailability[],

  employees: Employee[],
): EmployeeMonthAvailability[] {
  const employeeIds = new Set(employees.map((employee) => employee.employeeId));

  return availability.filter((record) => employeeIds.has(record.employeeId));
}

export function applyFocusMonthAvailabilityFilter(
  availability: EmployeeMonthAvailability[],

  filters: ResourceFilters,
): EmployeeMonthAvailability[] {
  if (filters.availabilityStatus.length === 0) {
    return availability;
  }

  const focusRecords = availability.filter(
    (record) => record.monthKey === filters.focusMonth,
  );

  const matchingEmployeeIds = new Set<string>();

  for (const record of focusRecords) {
    const matches = filters.availabilityStatus.some((status) => {
      if (status === "WITH_CAPACITY") {
        return record.availableHours > 0;
      }

      return record.status === status;
    });

    if (matches) {
      matchingEmployeeIds.add(record.employeeId);
    }
  }

  return availability.filter((record) =>
    matchingEmployeeIds.has(record.employeeId),
  );
}

export function getFilteredAvailabilityPopulation(
  availability: EmployeeMonthAvailability[],

  employees: Employee[],

  filters: ResourceFilters,
): EmployeeMonthAvailability[] {
  const filteredEmployees = filterEmployees(employees, filters);

  const populationAvailability = filterAvailabilityByEmployeePopulation(
    availability,
    filteredEmployees,
  );

  return applyFocusMonthAvailabilityFilter(populationAvailability, filters);
}

function getOptionCount(
  employees: Employee[],
  dimension: ResourceDimension,
  value: string,
): number {
  return employees.filter(
    (employee) => getEmployeeDimensionValue(employee, dimension) === value,
  ).length;
}

function getDimensionOptions(
  employees: Employee[],
  dimension: ResourceDimension,
): ResourceFilterOption[] {
  const values = [
    ...new Set(
      employees
        .map((employee) => getEmployeeDimensionValue(employee, dimension))
        .filter((value) => value !== ""),
    ),
  ].sort((left, right) =>
    left.localeCompare(right, undefined, {
      numeric: true,
    }),
  );

  return values.map((value) => ({
    value,
    label: value,
    count: getOptionCount(employees, dimension, value),
  }));
}

function getEmployeesForOptionDimension(
  employees: Employee[],
  filters: ResourceFilters,
  dimension: ResourceDimension,
): Employee[] {
  return employees.filter(
    (employee) =>
      matchesSearch(employee, filters.search) &&
      matchesDimensions(employee, filters, dimension),
  );
}

export function getResourceFilterOptions(
  employees: Employee[],
  filters: ResourceFilters,
): ResourceFilterOptions {
  return {
    primaryCapability: getDimensionOptions(
      getEmployeesForOptionDimension(employees, filters, "primaryCapability"),
      "primaryCapability",
    ),

    secondaryCapability: getDimensionOptions(
      getEmployeesForOptionDimension(employees, filters, "secondaryCapability"),
      "secondaryCapability",
    ),

    department: getDimensionOptions(
      getEmployeesForOptionDimension(employees, filters, "department"),
      "department",
    ),

    grade: getDimensionOptions(
      getEmployeesForOptionDimension(employees, filters, "grade"),
      "grade",
    ),

    location: getDimensionOptions(
      getEmployeesForOptionDimension(employees, filters, "location"),
      "location",
    ),

    country: getDimensionOptions(
      getEmployeesForOptionDimension(employees, filters, "country"),
      "country",
    ),
  };
}

export function getActiveDimensionFilterCount(
  filters: ResourceFilters,
): number {
  return DIMENSIONS.reduce(
    (total, dimension) => total + filters[dimension].length,
    0,
  );
}

export function getTotalActiveFilterCount(filters: ResourceFilters): number {
  return (
    getActiveDimensionFilterCount(filters) +
    filters.availabilityStatus.length +
    (filters.search.trim() !== "" ? 1 : 0)
  );
}

export function getOperationalAvailableHours(
  record: EmployeeMonthAvailability,
): number {
  /*
   * Phase 5:
   * operational availability = availableHours.
   *
   * Later blocking can change this single selector
   * to availableToPromiseHours without spreading
   * blocking-specific logic through the UI.
   */
  return record.availableHours;
}
