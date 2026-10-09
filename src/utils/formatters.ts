const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const LONG_MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatHours(
  value: number,
): string {
  if (!Number.isFinite(value)) {
    return "—";
  }

  const rounded =
    Math.round(
      value * 10,
    ) / 10;

  const formatted =
    Number.isInteger(
      rounded,
    )
      ? rounded.toLocaleString(
          "en-US",
          {
            maximumFractionDigits:
              0,
          },
        )
      : rounded.toLocaleString(
          "en-US",
          {
            minimumFractionDigits:
              1,

            maximumFractionDigits:
              1,
          },
        );

  return `${formatted}h`;
}

export function formatPercentage(
  value: number,
): string {
  if (!Number.isFinite(value)) {
    return "—";
  }

  const rounded =
    Math.round(
      value * 10,
    ) / 10;

  return `${rounded.toLocaleString(
    "en-US",
    {
      maximumFractionDigits:
        1,
    },
  )}%`;
}

function monthKeyToDate(monthKey: string): Date {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);

  if (match === null) {
    throw new Error(`Invalid month key: ${monthKey}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (month < 1 || month > 12) {
    throw new Error(`Invalid month key: ${monthKey}`);
  }

  return new Date(Date.UTC(year, month - 1, 1));
}

export function formatMonth(
  monthKey: string,
): string {
  const match =
    /^(\d{4})-(\d{2})$/.exec(
      monthKey,
    );

  if (match === null) {
    return monthKey;
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    },
  ).format(
    new Date(
      Date.UTC(
        Number(match[1]),
        Number(match[2]) - 1,
        1,
      ),
    ),
  );
}

export function formatLongMonth(
  monthKey: string,
): string {
  const match =
    /^(\d{4})-(\d{2})$/.exec(
      monthKey,
    );

  if (match === null) {
    return monthKey;
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    },
  ).format(
    new Date(
      Date.UTC(
        Number(match[1]),
        Number(match[2]) - 1,
        1,
      ),
    ),
  );
}

export function formatMonthShort(
  monthKey: string,
): string {
  const match =
    /^(\d{4})-(\d{2})$/.exec(
      monthKey,
    );

  if (match === null) {
    return monthKey;
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      timeZone: "UTC",
    },
  )
    .format(
      new Date(
        Date.UTC(
          Number(match[1]),
          Number(match[2]) - 1,
          1,
        ),
      ),
    )
    .toUpperCase();
}