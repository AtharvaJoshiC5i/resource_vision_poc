import type {
  ResourceAggregate,
  ResourceMonthlyRecord,
} from "../types/resourceMonthly";

function roundPercentage(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function aggregateResourceRecords(
  records: ResourceMonthlyRecord[],
): ResourceAggregate {
  const totals = records.reduce(
    (aggregate, record) => {
      aggregate.totalCapacity += record.total_capacity;

      aggregate.utilizedCapacity += record.utilized_capacity;

      aggregate.availableCapacity += record.available_capacity;

      return aggregate;
    },
    {
      totalCapacity: 0,
      utilizedCapacity: 0,
      availableCapacity: 0,
    },
  );

  if (totals.totalCapacity === 0) {
    return {
      ...totals,
      availabilityPercentage: 0,
      utilizationPercentage: 0,
    };
  }

  return {
    ...totals,

    availabilityPercentage: roundPercentage(
      (totals.availableCapacity / totals.totalCapacity) * 100,
    ),

    utilizationPercentage: roundPercentage(
      (totals.utilizedCapacity / totals.totalCapacity) * 100,
    ),
  };
}
