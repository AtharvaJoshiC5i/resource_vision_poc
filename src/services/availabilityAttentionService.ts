import type {
  EmployeeMonthAvailability,
} from "../types/domain";

import type {
  AvailabilityAttentionItem,
  UpcomingAvailabilityMonthSummary,
} from "../types/availabilityAttention";

import {
  compareMonthKeys,
} from "./monthService";

function groupByEmployee(
  records:
    EmployeeMonthAvailability[],
): Map<
  string,
  EmployeeMonthAvailability[]
> {
  const groups =
    new Map<
      string,
      EmployeeMonthAvailability[]
    >();

  for (const record of records) {
    const existing =
      groups.get(
        record.employeeId,
      ) ?? [];

    existing.push(record);

    groups.set(
      record.employeeId,
      existing,
    );
  }

  for (
    const employeeRecords
    of groups.values()
  ) {
    employeeRecords.sort(
      (left, right) =>
        compareMonthKeys(
          left.monthKey,
          right.monthKey,
        ),
    );
  }

  return groups;
}

export function getUpcomingAvailabilityMonthSummaries(
  records:
    EmployeeMonthAvailability[],
): UpcomingAvailabilityMonthSummary[] {
  const groups =
    groupByEmployee(
      records,
    );

  const summaries =
    new Map<
      string,
      UpcomingAvailabilityMonthSummary
    >();

  for (
    const employeeRecords
    of groups.values()
  ) {
    for (
      let index = 1;
      index <
      employeeRecords.length;
      index += 1
    ) {
      const previous =
        employeeRecords[
          index - 1
        ];

      const current =
        employeeRecords[
          index
        ];

      const capacityGain =
        current.availableHours -
        previous.availableHours;

      if (capacityGain <= 0) {
        continue;
      }

      const existing =
        summaries.get(
          current.monthKey,
        ) ?? {
          monthKey:
            current.monthKey,

          resourcesGainingCapacity:
            0,

          additionalAvailableHours:
            0,

          resourcesBecomingFullyAvailable:
            0,
        };

      existing.resourcesGainingCapacity +=
        1;

      existing.additionalAvailableHours +=
        capacityGain;

      if (
        previous.status !==
          "AVAILABLE" &&
        current.status ===
          "AVAILABLE"
      ) {
        existing.resourcesBecomingFullyAvailable +=
          1;
      }

      summaries.set(
        current.monthKey,
        existing,
      );
    }
  }

  return [
    ...summaries.values(),
  ].sort(
    (left, right) =>
      compareMonthKeys(
        left.monthKey,
        right.monthKey,
      ),
  );
}

export function getAvailabilityAttentionItems(
  records:
    EmployeeMonthAvailability[],
): AvailabilityAttentionItem[] {
  const groups =
    groupByEmployee(
      records,
    );

  const items:
    AvailabilityAttentionItem[] =
    [];

  for (
    const employeeRecords
    of groups.values()
  ) {
    /*
     * Current over-allocation is important
     * even if there is no previous month
     * available for comparison.
     */
    for (
      const record
      of employeeRecords
    ) {
      if (
        record.status ===
        "OVER_ALLOCATED"
      ) {
        items.push({
          employeeId:
            record.employeeId,

          employeeName:
            record.employeeName,

          primaryCapability:
            record.primaryCapability,

          grade:
            record.grade,

          monthKey:
            record.monthKey,

          type:
            "OVER_ALLOCATED",

          currentAvailableHours:
            record.availableHours,

          status:
            record.status,

          overAllocatedHours:
            Math.abs(
              record.availableHours,
            ),
        });
      }
    }

    for (
      let index = 1;
      index <
      employeeRecords.length;
      index += 1
    ) {
      const previous =
        employeeRecords[
          index - 1
        ];

      const current =
        employeeRecords[
          index
        ];

      const changeHours =
        current.availableHours -
        previous.availableHours;

      if (changeHours >= 0) {
        continue;
      }

      /*
       * If the employee becomes over-allocated,
       * that is more useful than also showing a
       * generic reduction item for the same move.
       */
      if (
        current.status ===
          "OVER_ALLOCATED" &&
        previous.status !==
          "OVER_ALLOCATED"
      ) {
        items.push({
          employeeId:
            current.employeeId,

          employeeName:
            current.employeeName,

          primaryCapability:
            current.primaryCapability,

          grade:
            current.grade,

          monthKey:
            current.monthKey,

          type:
            "BECOMING_OVER_ALLOCATED",

          previousAvailableHours:
            previous.availableHours,

          currentAvailableHours:
            current.availableHours,

          changeHours,

          status:
            current.status,

          overAllocatedHours:
            Math.abs(
              current.availableHours,
            ),
        });

        continue;
      }

      if (
        current.status ===
          "FULLY_ALLOCATED" &&
        previous.status !==
          "FULLY_ALLOCATED"
      ) {
        items.push({
          employeeId:
            current.employeeId,

          employeeName:
            current.employeeName,

          primaryCapability:
            current.primaryCapability,

          grade:
            current.grade,

          monthKey:
            current.monthKey,

          type:
            "BECOMING_FULLY_ALLOCATED",

          previousAvailableHours:
            previous.availableHours,

          currentAvailableHours:
            current.availableHours,

          changeHours,

          status:
            current.status,

          overAllocatedHours:
            0,
        });

        continue;
      }

      items.push({
        employeeId:
          current.employeeId,

        employeeName:
          current.employeeName,

        primaryCapability:
          current.primaryCapability,

        grade:
          current.grade,

        monthKey:
          current.monthKey,

        type:
          "CAPACITY_REDUCTION",

        previousAvailableHours:
          previous.availableHours,

        currentAvailableHours:
          current.availableHours,

        changeHours,

        status:
          current.status,

        overAllocatedHours:
          0,
      });
    }
  }

  return items.sort(
    (left, right) => {
      const monthComparison =
        compareMonthKeys(
          left.monthKey,
          right.monthKey,
        );

      if (
        monthComparison !== 0
      ) {
        return monthComparison;
      }

      return (
        left.currentAvailableHours -
        right.currentAvailableHours
      );
    },
  );
}