import type { WearStatus } from '@/db/schema';
import type {
  DailyStatisticsGraphPoint,
  RecentTreatmentDay,
  StatisticsGraphRange,
  StatisticsGraphReadModel,
  StatisticsPlanVersion,
  StatisticsReadModel,
  StatisticsSnapshot,
  StatisticsSummary,
  StatisticsTrayPeriod,
  StatisticsWearPunch,
  TrayPeriodStatisticsGraphPoint,
} from '@/features/statistics/statistics-model';

const MILLISECONDS_PER_SECOND = 1000;
const MILLISECONDS_PER_MINUTE = 60 * MILLISECONDS_PER_SECOND;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

type TreatmentDayWindow = {
  dateEnd: number;
  dateStart: number;
  goalEffectiveAt: number;
  windowEnd: number;
  windowStart: number;
};

type CalculatedTreatmentDay = RecentTreatmentDay & {
  dateEnd: number;
  goalMilliseconds: number;
  inMilliseconds: number;
  outMilliseconds: number;
  windowEnd: number;
  windowStart: number;
};

function getLocalDayStart(timestamp: number) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function addLocalDays(timestamp: number, days: number) {
  const date = new Date(getLocalDayStart(timestamp));
  date.setDate(date.getDate() + days);
  return date.getTime();
}

function orderTrayPeriods(periods: readonly StatisticsTrayPeriod[]) {
  return [...periods].sort(
    (left, right) => left.startedAt - right.startedAt || left.id - right.id,
  );
}

function orderPunches(punches: readonly StatisticsWearPunch[]) {
  return [...punches].sort(
    (left, right) => left.timestamp - right.timestamp || left.id - right.id,
  );
}

function orderPlans(plans: readonly StatisticsPlanVersion[]) {
  return [...plans].sort(
    (left, right) => left.effectiveAt - right.effectiveAt || left.id - right.id,
  );
}

function createTreatmentDayWindows(
  treatmentStartedAt: number,
  rangeStartedAt: number,
  rangeEndedAt: number,
) {
  if (rangeEndedAt < rangeStartedAt) {
    return [];
  }

  const windows: TreatmentDayWindow[] = [];
  const finalDateStart = getLocalDayStart(rangeEndedAt);

  for (
    let dateStart = getLocalDayStart(rangeStartedAt);
    dateStart <= finalDateStart;
    dateStart = addLocalDays(dateStart, 1)
  ) {
    const nextDateStart = addLocalDays(dateStart, 1);
    windows.push({
      dateEnd: nextDateStart,
      dateStart,
      goalEffectiveAt: Math.max(dateStart, treatmentStartedAt),
      windowEnd: Math.min(nextDateStart, rangeEndedAt),
      windowStart: Math.max(dateStart, rangeStartedAt),
    });
  }

  return windows;
}

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

function getPlanForTreatmentDay(
  orderedPlans: readonly StatisticsPlanVersion[],
  effectiveAt: number,
) {
  let selectedPlan: StatisticsPlanVersion | null = null;

  for (const plan of orderedPlans) {
    if (plan.effectiveAt > effectiveAt) {
      break;
    }

    selectedPlan = plan;
  }

  if (selectedPlan === null) {
    throw new Error('Treatment history has no plan effective for a tracked day.');
  }

  return selectedPlan;
}

function calculateDays(
  windows: readonly TreatmentDayWindow[],
  orderedPunches: readonly StatisticsWearPunch[],
  orderedPlans: readonly StatisticsPlanVersion[],
  treatmentStartedAt: number,
): CalculatedTreatmentDay[] {
  let punchIndex = 0;
  let status: WearStatus | null = null;
  const firstDateStart = getLocalDayStart(treatmentStartedAt);

  return windows.map((window) => {
    const totals: Record<WearStatus, number> = { IN: 0, OUT: 0 };
    let intervalStartedAt = window.windowStart;

    while (
      punchIndex < orderedPunches.length &&
      orderedPunches[punchIndex].timestamp <= window.windowStart
    ) {
      status = orderedPunches[punchIndex].status;
      punchIndex += 1;
    }

    while (
      punchIndex < orderedPunches.length &&
      orderedPunches[punchIndex].timestamp < window.windowEnd
    ) {
      const punch = orderedPunches[punchIndex];
      addElapsedTime(totals, status, intervalStartedAt, punch.timestamp);
      status = punch.status;
      intervalStartedAt = punch.timestamp;
      punchIndex += 1;
    }

    addElapsedTime(totals, status, intervalStartedAt, window.windowEnd);
    const plan = getPlanForTreatmentDay(orderedPlans, window.goalEffectiveAt);
    const goalWindowRatio =
      window.dateStart === firstDateStart
        ? (window.dateEnd - treatmentStartedAt) /
          (window.dateEnd - window.dateStart)
        : 1;

    const goalMilliseconds =
      plan.dailyWearGoalMinutes * MILLISECONDS_PER_MINUTE * goalWindowRatio;

    return {
      dateEnd: window.dateEnd,
      dateStart: window.dateStart,
      goalMet: totals.IN >= goalMilliseconds,
      goalMilliseconds,
      inMilliseconds: totals.IN,
      inSeconds: Math.floor(totals.IN / MILLISECONDS_PER_SECOND),
      outMilliseconds: totals.OUT,
      outSeconds: Math.floor(totals.OUT / MILLISECONDS_PER_SECOND),
      windowEnd: window.windowEnd,
      windowStart: window.windowStart,
    };
  });
}

function getSummaryDurations(
  day: CalculatedTreatmentDay,
  treatmentStartedAt: number,
  normalizeCompletedFirstDay: boolean,
) {
  const isCompletedFirstTreatmentDay =
    normalizeCompletedFirstDay &&
    day.dateStart === getLocalDayStart(treatmentStartedAt) &&
    day.windowStart === treatmentStartedAt &&
    day.windowEnd === day.dateEnd;

  if (!isCompletedFirstTreatmentDay) {
    return {
      inMilliseconds: day.inMilliseconds,
      outMilliseconds: day.outMilliseconds,
    };
  }

  const localDayDuration = day.dateEnd - day.dateStart;
  const remainingDayDuration = day.dateEnd - treatmentStartedAt;
  const normalizationFactor = localDayDuration / remainingDayDuration;

  return {
    inMilliseconds: day.inMilliseconds * normalizationFactor,
    outMilliseconds: day.outMilliseconds * normalizationFactor,
  };
}

function summarizeDays(
  days: readonly CalculatedTreatmentDay[],
  treatmentStartedAt: number,
  normalizeCompletedFirstDay: boolean,
): StatisticsSummary {
  const totals = days.reduce(
    (result, day) => {
      const durations = getSummaryDurations(
        day,
        treatmentStartedAt,
        normalizeCompletedFirstDay,
      );

      return {
        goalMetDays: result.goalMetDays + (day.goalMet ? 1 : 0),
        inMilliseconds: result.inMilliseconds + durations.inMilliseconds,
        outMilliseconds: result.outMilliseconds + durations.outMilliseconds,
      };
    },
    { goalMetDays: 0, inMilliseconds: 0, outMilliseconds: 0 },
  );
  const trackedDays = days.length;

  return {
    averageInSeconds:
      trackedDays === 0
        ? 0
        : Math.floor(totals.inMilliseconds / trackedDays / MILLISECONDS_PER_SECOND),
    averageOutSeconds:
      trackedDays === 0
        ? 0
        : Math.floor(totals.outMilliseconds / trackedDays / MILLISECONDS_PER_SECOND),
    goalMetDays: totals.goalMetDays,
    trackedDays,
  };
}

export function formatStatisticsDuration(totalSeconds: number) {
  const totalMinutes = Math.floor(
    Math.max(0, totalSeconds) / SECONDS_PER_MINUTE,
  );
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const minutes = totalMinutes % MINUTES_PER_HOUR;

  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function formatStatisticsGoalDifference(totalSeconds: number) {
  if (totalSeconds === 0) {
    return 'Goal met exactly';
  }

  return totalSeconds > 0
    ? `Met by ${formatStatisticsDuration(totalSeconds)}`
    : `Short by ${formatStatisticsDuration(Math.abs(totalSeconds))}`;
}

export function formatStatisticsTrayDuration(totalSeconds: number) {
  const totalMinutes = Math.floor(
    Math.max(0, totalSeconds) / SECONDS_PER_MINUTE,
  );
  const days = Math.floor(totalMinutes / (MINUTES_PER_HOUR * HOURS_PER_DAY));
  const remainingMinutes = totalMinutes % (MINUTES_PER_HOUR * HOURS_PER_DAY);
  const hours = Math.floor(remainingMinutes / MINUTES_PER_HOUR);
  const minutes = remainingMinutes % MINUTES_PER_HOUR;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }

  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function getStatisticsTreatmentBounds(snapshot: StatisticsSnapshot, now: number) {
  const orderedTrayPeriods = orderTrayPeriods(snapshot.trayPeriods);
  const firstTray = orderedTrayPeriods[0];
  const activeTray = [...orderedTrayPeriods]
    .filter((period) => period.endedAt === null && period.startedAt <= now)
    .sort((left, right) => right.startedAt - left.startedAt || right.id - left.id)[0];

  if (!activeTray || !firstTray || !Number.isFinite(firstTray.startedAt)) {
    throw new Error('Statistics require an active treatment history.');
  }

  return { activeTray, firstTray, orderedTrayPeriods };
}

function getStatisticsGraphRangeStart(
  range: StatisticsGraphRange,
  treatmentStartedAt: number,
  now: number,
) {
  if (range === 'treatment') {
    return treatmentStartedAt;
  }

  const includedDayCount = range === '7-days' ? 7 : 30;
  const requestedStart = addLocalDays(getLocalDayStart(now), -(includedDayCount - 1));
  return Math.max(treatmentStartedAt, requestedStart);
}

function createDailyGraphPoints(
  snapshot: StatisticsSnapshot,
  treatmentStartedAt: number,
  rangeStartedAt: number,
  now: number,
): DailyStatisticsGraphPoint[] {
  return calculateDays(
    createTreatmentDayWindows(treatmentStartedAt, rangeStartedAt, now),
    orderPunches(snapshot.punches),
    orderPlans(snapshot.planVersions),
    treatmentStartedAt,
  ).map((day) => ({
    dateStart: day.dateStart,
    goalDifferenceSeconds:
      (day.inMilliseconds - day.goalMilliseconds) / MILLISECONDS_PER_SECOND,
    goalMet: day.goalMet,
    goalSeconds: day.goalMilliseconds / MILLISECONDS_PER_SECOND,
    inSeconds: day.inSeconds,
  }));
}

function createTrayPeriodGraphPoints(
  orderedTrayPeriods: readonly StatisticsTrayPeriod[],
  rangeStartedAt: number,
  now: number,
): TrayPeriodStatisticsGraphPoint[] {
  const totalOccurrences = orderedTrayPeriods.reduce<Map<number, number>>(
    (counts, period) => {
      counts.set(period.trayNumber, (counts.get(period.trayNumber) ?? 0) + 1);
      return counts;
    },
    new Map(),
  );
  const seenOccurrences = new Map<number, number>();

  return orderedTrayPeriods.flatMap((period) => {
    const occurrence = (seenOccurrences.get(period.trayNumber) ?? 0) + 1;
    seenOccurrences.set(period.trayNumber, occurrence);

    const periodEndedAt = Math.min(period.endedAt ?? now, now);
    const startedAt = Math.max(period.startedAt, rangeStartedAt);
    const endedAt = periodEndedAt;
    const isInstantActivePeriod =
      period.endedAt === null && period.startedAt === now;

    if (
      period.startedAt > now ||
      (periodEndedAt <= rangeStartedAt && !isInstantActivePeriod) ||
      endedAt < startedAt
    ) {
      return [];
    }

    const repeated = (totalOccurrences.get(period.trayNumber) ?? 0) > 1;
    const point: TrayPeriodStatisticsGraphPoint = {
      durationSeconds: Math.floor((endedAt - startedAt) / MILLISECONDS_PER_SECOND),
      endedAt,
      id: period.id,
      isActive: period.endedAt === null,
      label: repeated
        ? `Tray ${period.trayNumber} · Period ${occurrence}`
        : `Tray ${period.trayNumber}`,
      startedAt,
      trayNumber: period.trayNumber,
    };

    return [point];
  });
}

export function createStatisticsGraphReadModel(
  snapshot: StatisticsSnapshot,
  range: StatisticsGraphRange,
  now = Date.now(),
): StatisticsGraphReadModel {
  const { firstTray, orderedTrayPeriods } = getStatisticsTreatmentBounds(snapshot, now);
  const rangeStartedAt = getStatisticsGraphRangeStart(range, firstTray.startedAt, now);

  return {
    dailyPoints: createDailyGraphPoints(
      snapshot,
      firstTray.startedAt,
      rangeStartedAt,
      now,
    ),
    rangeEndedAt: now,
    rangeStartedAt,
    trayPeriods: createTrayPeriodGraphPoints(orderedTrayPeriods, rangeStartedAt, now),
  };
}

export function createStatisticsReadModel(
  snapshot: StatisticsSnapshot,
  now = Date.now(),
): StatisticsReadModel {
  const { activeTray, firstTray } = getStatisticsTreatmentBounds(snapshot, now);

  const treatmentStartedAt = firstTray.startedAt;
  const orderedPunches = orderPunches(snapshot.punches);
  const orderedPlans = orderPlans(snapshot.planVersions);
  const overallDays = calculateDays(
    createTreatmentDayWindows(treatmentStartedAt, treatmentStartedAt, now),
    orderedPunches,
    orderedPlans,
    treatmentStartedAt,
  );
  const currentTrayDays = calculateDays(
    createTreatmentDayWindows(treatmentStartedAt, activeTray.startedAt, now),
    orderedPunches,
    orderedPlans,
    treatmentStartedAt,
  );
  const currentTraySummary = summarizeDays(
    currentTrayDays,
    treatmentStartedAt,
    activeTray.id === firstTray.id,
  );

  return {
    currentTray: {
      ...currentTraySummary,
      daysWorn: currentTraySummary.trackedDays,
    },
    recentDays: overallDays
      .slice(-7)
      .reverse()
      .map(
        ({
          dateEnd: _dateEnd,
          goalMilliseconds: _goalMilliseconds,
          inMilliseconds: _inMilliseconds,
          outMilliseconds: _outMilliseconds,
          windowEnd: _windowEnd,
          windowStart: _windowStart,
          ...day
        }) => day,
      ),
    treatmentOverall: summarizeDays(overallDays, treatmentStartedAt, true),
  };
}
