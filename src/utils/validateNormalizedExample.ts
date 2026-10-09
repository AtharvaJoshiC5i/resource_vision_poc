import expectedData from "../data/resourceMonthlyRecords.example.json";

import type { ResourceMonthlyRecord } from "../types/resourceMonthly";

interface ExpectedResourceMonthlyRecord {
  employee_id: string;
  month_key: string;
  total_capacity: number;
  utilized_capacity: number;
  available_capacity: number;
  availability_percentage: number;
  source: string;
}

export interface ExampleValidationResult {
  matches: boolean;
  generatedCount: number;
  expectedCount: number;
  discrepancies: string[];
}

function createKey(employeeId: string, monthKey: string): string {
  return `${employeeId}::${monthKey}`;
}

function numbersMatch(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.01;
}

export function validateAgainstNormalizedExample(
  generated: ResourceMonthlyRecord[],
): ExampleValidationResult {
  const expected = expectedData as ExpectedResourceMonthlyRecord[];

  const discrepancies: string[] = [];

  const generatedLookup = new Map(
    generated.map((record) => [
      createKey(record.employee_id, record.month_key),
      record,
    ]),
  );

  const expectedLookup = new Map(
    expected.map((record) => [
      createKey(record.employee_id, record.month_key),
      record,
    ]),
  );

  if (generated.length !== expected.length) {
    discrepancies.push(
      `Record count differs: generated=${generated.length}, expected=${expected.length}.`,
    );
  }

  for (const [key, expectedRecord] of expectedLookup) {
    const generatedRecord = generatedLookup.get(key);

    if (generatedRecord === undefined) {
      discrepancies.push(`Missing generated employee/month: ${key}.`);

      continue;
    }

    const numericChecks = [
      {
        field: "total_capacity",
        generated: generatedRecord.total_capacity,
        expected: expectedRecord.total_capacity,
      },
      {
        field: "utilized_capacity",
        generated: generatedRecord.utilized_capacity,
        expected: expectedRecord.utilized_capacity,
      },
      {
        field: "available_capacity",
        generated: generatedRecord.available_capacity,
        expected: expectedRecord.available_capacity,
      },
      {
        field: "availability_percentage",
        generated: generatedRecord.availability_percentage,
        expected: expectedRecord.availability_percentage,
      },
    ];

    for (const check of numericChecks) {
      if (!numbersMatch(check.generated, check.expected)) {
        discrepancies.push(
          `${key} ${check.field}: generated=${check.generated}, expected=${check.expected}.`,
        );
      }
    }

    if (generatedRecord.source !== expectedRecord.source) {
      discrepancies.push(
        `${key} source: generated=${generatedRecord.source}, expected=${expectedRecord.source}.`,
      );
    }
  }

  for (const key of generatedLookup.keys()) {
    if (!expectedLookup.has(key)) {
      discrepancies.push(
        `Generated employee/month is absent from example: ${key}.`,
      );
    }
  }

  return {
    matches: discrepancies.length === 0,
    generatedCount: generated.length,
    expectedCount: expected.length,
    discrepancies,
  };
}

export function logNormalizedExampleValidation(
  generated: ResourceMonthlyRecord[],
): void {
  const result = validateAgainstNormalizedExample(generated);

  if (result.matches) {
    console.info(
      `[Resource Vision] Normalized example validation passed (${result.generatedCount} records).`,
    );

    return;
  }

  console.warn(
    `[Resource Vision] Normalized example differs from generated output. Generated=${result.generatedCount}, expected=${result.expectedCount}.`,
  );

  for (const discrepancy of result.discrepancies) {
    console.warn(`[Resource Vision] ${discrepancy}`);
  }
}
