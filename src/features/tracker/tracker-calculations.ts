import type { WearStatus } from '@/db/schema';
import type {
  TrackerReadModel,
  TrackerSnapshot,
  WearPunchEvent,
} from '@/features/tracker/tracker-model';

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_HOUR = SECONDS_PER_MINUTE * MINUTES_PER_HOUR;
const MILLISECONDS_PER_SECOND = 1000;
const MILLISECONDS_PER_CALENDAR_DAY = 24 * SECONDS_PER_HOUR * MILLISECONDS_PER_SECOND;

function padTimePart(value: number) {
  return String(value).padStart(2, '0');
}

export function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((safeSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const seconds = safeSeconds % SECONDS_PER_MINUTE;

  return `${padTimePart(hours)}:${padTimePart(minutes)}:${padTimePart(seconds)}`;
}

function getLocalCalendarDayNumber(timestamp: number) {
  const date = new Date(timestamp);

  return (
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) /
    MILLISECONDS_PER_CALENDAR_DAY
  );
}

export function getLocalDayStart(timestamp: number) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function calculateTrayDay(trayStartedAt: number, now: number) {
  const elapsedCalendarDays =
    getLocalCalendarDayNumber(now) - getLocalCalendarDayNumber(trayStartedAt);

  return Math.max(1, elapsedCalendarDays + 1);
}

export function calculateDaysRemaining(daysPerTray: number, trayDay: number) {
  return Math.max(0, daysPerTray - trayDay);
}

export type DailyWearTotals = {
  inSeconds: number;
  outSeconds: number;
};

function addElapsedTime(
  totals: Record<WearStatus, number>,
  status: WearStatus | null,
  start: number,
  end: number,
) {
  if (status !== null && end > start) {
    totals[status] += end - start;
  }
}

function orderPunches(punches: readonly WearPunchEvent[]) {
  return [...punches].sort(
    (left, right) => left.timestamp - right.timestamp || left.id - right.id,
  );
}

export function getLatestWearPunch(punches: readonly WearPunchEvent[]) {
  return punches.reduce<WearPunchEvent | null>((latest, punch) => {
    if (
      latest === null ||
      punch.timestamp > latest.timestamp ||
      (punch.timestamp === latest.timestamp && punch.id > latest.id)
    ) {
      return punch;
    }

    return latest;
  }, null);
}

export function calculateDailyWearTotals(
  punches: readonly WearPunchEvent[],
  dayStart: number,
  now: number,
): DailyWearTotals {
  if (now <= dayStart) {
    return { inSeconds: 0, outSeconds: 0 };
  }

  const totalsInMilliseconds: Record<WearStatus, number> = { IN: 0, OUT: 0 };
  let currentStatus: WearStatus | null = null;
  let currentIntervalStartedAt = dayStart;

  for (const punch of orderPunches(punches)) {
    if (punch.timestamp > now) {
      break;
    }

    if (punch.timestamp <= dayStart) {
      currentStatus = punch.status;
      continue;
    }

    addElapsedTime(
      totalsInMilliseconds,
      currentStatus,
      currentIntervalStartedAt,
      punch.timestamp,
    );
    currentStatus = punch.status;
    currentIntervalStartedAt = punch.timestamp;
  }

  addElapsedTime(totalsInMilliseconds, currentStatus, currentIntervalStartedAt, now);

  return {
    inSeconds: Math.floor(totalsInMilliseconds.IN / MILLISECONDS_PER_SECOND),
    outSeconds: Math.floor(totalsInMilliseconds.OUT / MILLISECONDS_PER_SECOND),
  };
}

function getCurrentStatus(punches: readonly WearPunchEvent[], now: number) {
  let currentStatus: WearStatus | null = null;

  for (const punch of orderPunches(punches)) {
    if (punch.timestamp > now) {
      break;
    }

    currentStatus = punch.status;
  }

  if (currentStatus === null) {
    throw new Error('Tracker has no current wear state.');
  }

  return currentStatus;
}

export function createTrackerReadModel(snapshot: TrackerSnapshot, now: number): TrackerReadModel {
  const trayDay = calculateTrayDay(snapshot.trayStartedAt, now);
  const totals = calculateDailyWearTotals(snapshot.punches, getLocalDayStart(now), now);

  return {
    currentStatus: getCurrentStatus(snapshot.punches, now),
    currentTrayNumber: snapshot.currentTrayNumber,
    daysRemaining: calculateDaysRemaining(snapshot.daysPerTray, trayDay),
    inTodaySeconds: totals.inSeconds,
    outTodaySeconds: totals.outSeconds,
    totalTrays: snapshot.totalTrays,
    trayDay,
  };
}
