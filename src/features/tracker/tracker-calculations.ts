import type { WearStatus } from '@/db/schema';
import type {
  DailyWearInterval,
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

type RawDailyWearInterval = Omit<DailyWearInterval, 'durationSeconds'> & {
  durationMilliseconds: number;
};

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

function deriveRawDailyWearIntervals(
  punches: readonly WearPunchEvent[],
  dayStart: number,
  now: number,
): RawDailyWearInterval[] {
  if (now <= dayStart) {
    return [];
  }

  const intervals: RawDailyWearInterval[] = [];
  let currentStatus: WearStatus | null = null;
  let currentIntervalStartedAt = dayStart;

  const orderedPunches = orderPunches(punches);

  for (let punchIndex = 0; punchIndex < orderedPunches.length; punchIndex += 1) {
    let punch = orderedPunches[punchIndex];

    while (
      punchIndex + 1 < orderedPunches.length &&
      orderedPunches[punchIndex + 1].timestamp === punch.timestamp
    ) {
      punchIndex += 1;
      punch = orderedPunches[punchIndex];
    }

    if (punch.timestamp > now) {
      break;
    }

    if (punch.timestamp <= dayStart) {
      currentStatus = punch.status;
      continue;
    }

    if (currentStatus === null) {
      currentStatus = punch.status;
      currentIntervalStartedAt = punch.timestamp;
      continue;
    }

    if (punch.status === currentStatus) {
      continue;
    }

    if (punch.timestamp > currentIntervalStartedAt) {
      intervals.push({
        durationMilliseconds: punch.timestamp - currentIntervalStartedAt,
        endedAt: punch.timestamp,
        isOngoing: false,
        startedAt: currentIntervalStartedAt,
        status: currentStatus,
      });
    }

    currentStatus = punch.status;
    currentIntervalStartedAt = punch.timestamp;
  }

  if (currentStatus !== null && now > currentIntervalStartedAt) {
    intervals.push({
      durationMilliseconds: now - currentIntervalStartedAt,
      endedAt: now,
      isOngoing: true,
      startedAt: currentIntervalStartedAt,
      status: currentStatus,
    });
  }

  return intervals;
}

export function calculateDailyWearIntervals(
  punches: readonly WearPunchEvent[],
  dayStart: number,
  now: number,
): DailyWearInterval[] {
  const cumulativeMilliseconds: Record<WearStatus, number> = { IN: 0, OUT: 0 };
  const cumulativeSeconds: Record<WearStatus, number> = { IN: 0, OUT: 0 };

  return deriveRawDailyWearIntervals(punches, dayStart, now).map((interval) => {
    cumulativeMilliseconds[interval.status] += interval.durationMilliseconds;
    const nextCumulativeSeconds = Math.floor(
      cumulativeMilliseconds[interval.status] / MILLISECONDS_PER_SECOND,
    );
    const durationSeconds = nextCumulativeSeconds - cumulativeSeconds[interval.status];
    cumulativeSeconds[interval.status] = nextCumulativeSeconds;

    return {
      durationSeconds,
      endedAt: interval.endedAt,
      isOngoing: interval.isOngoing,
      startedAt: interval.startedAt,
      status: interval.status,
    };
  });
}

export function calculateDailyWearTotals(
  punches: readonly WearPunchEvent[],
  dayStart: number,
  now: number,
): DailyWearTotals {
  const totalsInMilliseconds = deriveRawDailyWearIntervals(punches, dayStart, now).reduce<
    Record<WearStatus, number>
  >(
    (totals, interval) => {
      totals[interval.status] += interval.durationMilliseconds;
      return totals;
    },
    { IN: 0, OUT: 0 },
  );

  return {
    inSeconds: Math.floor(totalsInMilliseconds.IN / MILLISECONDS_PER_SECOND),
    outSeconds: Math.floor(totalsInMilliseconds.OUT / MILLISECONDS_PER_SECOND),
  };
}

function getCurrentWearPunch(punches: readonly WearPunchEvent[], now: number) {
  let currentPunch: WearPunchEvent | null = null;

  for (const punch of orderPunches(punches)) {
    if (punch.timestamp > now) {
      break;
    }

    currentPunch = punch;
  }

  if (currentPunch === null) {
    throw new Error('Tracker has no current wear state.');
  }

  return currentPunch;
}

export function createTrackerReadModel(snapshot: TrackerSnapshot, now: number): TrackerReadModel {
  const trayDay = calculateTrayDay(snapshot.trayStartedAt, now);
  const totals = calculateDailyWearTotals(snapshot.punches, getLocalDayStart(now), now);
  const currentPunch = getCurrentWearPunch(snapshot.punches, now);
  const currentOutSeconds =
    currentPunch.status === 'OUT'
      ? Math.floor((now - currentPunch.timestamp) / MILLISECONDS_PER_SECOND)
      : 0;

  return {
    currentStatus: currentPunch.status,
    currentOutSeconds,
    currentTrayNumber: snapshot.currentTrayNumber,
    daysRemaining: calculateDaysRemaining(snapshot.daysPerTray, trayDay),
    inTodaySeconds: totals.inSeconds,
    outTodaySeconds: totals.outSeconds,
    totalTrays: snapshot.totalTrays,
    trayDay,
  };
}
