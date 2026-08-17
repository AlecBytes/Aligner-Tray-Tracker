const MILLISECONDS_PER_DAY = 86_400_000;

export type TreatmentHistoryDay = {
  dateKey: string;
  timestamp: number;
};

export type TreatmentHistoryWeek = {
  days: TreatmentHistoryDay[];
  endTimestamp: number;
  startTimestamp: number;
  weekNumber: number;
};

function padDatePart(value: number) {
  return String(value).padStart(2, '0');
}

function localCalendarDayNumber(timestamp: number) {
  const date = new Date(timestamp);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MILLISECONDS_PER_DAY;
}

export function getLocalDateStart(timestamp: number) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function addLocalDays(timestamp: number, days: number) {
  const date = new Date(getLocalDateStart(timestamp));
  date.setDate(date.getDate() + days);
  return date.getTime();
}

export function formatLocalDateKey(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

export function parseLocalDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  parsed.setHours(0, 0, 0, 0);
  return parsed.getTime();
}

export function formatLocalTime(timestamp: number) {
  const date = new Date(timestamp);
  return `${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`;
}

export function parseLocalDateTime(dateValue: string, timeValue: string) {
  const dayStart = parseLocalDateKey(dateValue.trim());
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(timeValue.trim());

  if (dayStart === null || !timeMatch) {
    return null;
  }

  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);

  if (hours > 23 || minutes > 59) {
    return null;
  }

  const parsed = new Date(dayStart);
  parsed.setHours(hours, minutes, 0, 0);

  if (parsed.getHours() !== hours || parsed.getMinutes() !== minutes) {
    return null;
  }

  return parsed.getTime();
}

function createDays(startTimestamp: number, endTimestamp: number) {
  const days: TreatmentHistoryDay[] = [];

  for (
    let timestamp = endTimestamp;
    timestamp >= startTimestamp;
    timestamp = addLocalDays(timestamp, -1)
  ) {
    days.push({ dateKey: formatLocalDateKey(timestamp), timestamp });
  }

  return days;
}

export function buildTreatmentDateHistory(treatmentStartedAt: number, now = Date.now()) {
  const treatmentStart = getLocalDateStart(treatmentStartedAt);
  const today = getLocalDateStart(now);
  const elapsedDays = localCalendarDayNumber(today) - localCalendarDayNumber(treatmentStart);

  if (elapsedDays < 0) {
    return { currentWeekDays: [] as TreatmentHistoryDay[], previousWeeks: [] as TreatmentHistoryWeek[] };
  }

  const currentWeekIndex = Math.floor(elapsedDays / 7);
  const currentWeekStart = addLocalDays(treatmentStart, currentWeekIndex * 7);
  const previousWeeks: TreatmentHistoryWeek[] = [];

  for (let weekIndex = currentWeekIndex - 1; weekIndex >= 0; weekIndex -= 1) {
    const startTimestamp = addLocalDays(treatmentStart, weekIndex * 7);
    const endTimestamp = addLocalDays(startTimestamp, 6);
    previousWeeks.push({
      days: createDays(startTimestamp, endTimestamp),
      endTimestamp,
      startTimestamp,
      weekNumber: weekIndex + 1,
    });
  }

  return {
    currentWeekDays: createDays(currentWeekStart, today),
    previousWeeks,
  };
}
