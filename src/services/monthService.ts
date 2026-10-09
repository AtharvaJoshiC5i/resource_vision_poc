export function parseMonthKey(monthKey: string): {
  year: number;
  month: number;
} {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());

  if (match === null) {
    throw new Error(`Invalid month key: ${monthKey}`);
  }

  const year = Number(match[1]);

  const month = Number(match[2]);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new Error(`Invalid month key: ${monthKey}`);
  }

  return {
    year,
    month,
  };
}

export function createMonthKey(year: number, month: number): string {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new Error(
      `Cannot create month key from year=${year}, month=${month}.`,
    );
  }

  return `${year}-${String(month).padStart(2, "0")}`;
}

export function getCurrentMonthKey(date: Date = new Date()): string {
  return createMonthKey(date.getFullYear(), date.getMonth() + 1);
}

export function addMonths(monthKey: string, offset: number): string {
  if (!Number.isInteger(offset)) {
    throw new Error(`Month offset must be an integer: ${offset}`);
  }

  const { year, month } = parseMonthKey(monthKey);

  const zeroBasedMonth = month - 1 + offset;

  const targetYear = year + Math.floor(zeroBasedMonth / 12);

  const normalizedMonth = (((zeroBasedMonth % 12) + 12) % 12) + 1;

  return createMonthKey(targetYear, normalizedMonth);
}

export function getMonthRange(
  startMonth: string,
  numberOfMonths: number,
): string[] {
  if (!Number.isInteger(numberOfMonths) || numberOfMonths < 0) {
    throw new Error(
      `numberOfMonths must be a non-negative integer: ${numberOfMonths}`,
    );
  }

  return Array.from(
    {
      length: numberOfMonths,
    },

    (_, index) => addMonths(startMonth, index),
  );
}

export function compareMonthKeys(left: string, right: string): number {
  const leftMonth = parseMonthKey(left);

  const rightMonth = parseMonthKey(right);

  if (leftMonth.year !== rightMonth.year) {
    return leftMonth.year - rightMonth.year;
  }

  return leftMonth.month - rightMonth.month;
}
