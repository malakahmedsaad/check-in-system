// Purpose: Centralizes app timezone and date range helpers.

export const APP_TIME_ZONE = "America/Indiana/Indianapolis";

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function getZonedDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function getTimeZoneOffsetMs(date: Date) {
  const parts = getZonedDateParts(date);
  const zonedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return zonedAsUtc - date.getTime();
}

export function getDateKey(date: Date) {
  return dateKeyFormatter.format(date);
}

export function startOfAppDay(date = new Date()) {
  const parts = getZonedDateParts(date);
  const utcGuess = Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0);
  const offset = getTimeZoneOffsetMs(new Date(utcGuess));

  return new Date(utcGuess - offset);
}

export function startOfAppMonth(date = new Date()) {
  const parts = getZonedDateParts(date);
  const utcGuess = Date.UTC(parts.year, parts.month - 1, 1, 0, 0, 0);
  const offset = getTimeZoneOffsetMs(new Date(utcGuess));

  return new Date(utcGuess - offset);
}

export function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

export function addMonths(date: Date, months: number) {
  const parts = getZonedDateParts(date);
  const utcGuess = Date.UTC(parts.year, parts.month - 1 + months, 1, 0, 0, 0);
  const offset = getTimeZoneOffsetMs(new Date(utcGuess));

  return new Date(utcGuess - offset);
}

export function getAppDayRange(date = new Date()) {
  const start = startOfAppDay(date);
  const end = addDays(start, 1);

  return { start, end };
}
