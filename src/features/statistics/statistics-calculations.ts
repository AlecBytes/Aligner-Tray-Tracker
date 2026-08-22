import type { WearStatus } from '@/db/schema';
import type {
  RecentTreatmentDay,
  StatisticsPlanVersion,
  StatisticsReadModel,
  StatisticsSnapshot,
  StatisticsSummary,
  StatisticsWearPunch,
} from '@/features/statistics/statistics-model';

const MILLISECONDS_PER_SECOND = 1000;
const MILLISECONDS_PER_MINUTE = 60 * MILLISECONDS_PER_SECOND;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;

type TreatmentDayWindow = {
  dateEnd: number;
  dateStart: number;
  goalEffectiveAt: number;
  windowEnd: number;
  windowStart: number;
};

type CalculatedTreatmentDay = RecentTreatmentDay & {
  dateEnd: number;
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

    return {
      dateEnd: window.dateEnd,
      dateStart: window.dateStart,
      goalMet:
        totals.IN >=
        plan.dailyWearGoalMinutes * MILLISECONDS_PER_MINUTE * goalWindowRatio,
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

export function createStatisticsReadModel(
  snapshot: StatisticsSnapshot,
  now = Date.now(),
): StatisticsReadModel {
  const activeTray = [...snapshot.trayPeriods]
    .filter((period) => period.endedAt === null && period.startedAt <= now)
    .sort((left, right) => right.startedAt - left.startedAt || right.id - left.id)[0];
  const firstTray = [...snapshot.trayPeriods].sort(
    (left, right) => left.startedAt - right.startedAt || left.id - right.id,
  )[0];

  if (!activeTray || !firstTray || !Number.isFinite(firstTray.startedAt)) {
    throw new Error('Statistics require an active treatment history.');
  }

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
