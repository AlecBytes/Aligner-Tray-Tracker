import {
  createStatisticsReadModel,
} from '@/features/statistics/statistics-calculations';
import type {
  RecentTreatmentDay,
  StatisticsSnapshot,
  StatisticsSummary,
} from '@/features/statistics/statistics-model';
import { calculateTrayDay, getLocalDayStart } from '@/features/tracker/tracker-calculations';

export const SHARE_PROGRESS_LEVELS = ['brief', 'summary', 'detailed'] as const;

export type ShareProgressLevel = (typeof SHARE_PROGRESS_LEVELS)[number];

export type ShareProgressSnapshot = {
  capturedAt: number;
  currentTray: StatisticsSummary;
  currentTrayNumber: number;
  dailyWearGoalMinutes: number;
  daysPerTray: number;
  recentDays: RecentTreatmentDay[];
  today: {
    inSeconds: number;
    outSeconds: number;
  };
  totalTrays: number;
  trayDay: number;
  treatmentOverall: StatisticsSummary;
};

function copySummary(summary: StatisticsSummary): StatisticsSummary {
  return {
    averageInSeconds: summary.averageInSeconds,
    averageOutSeconds: summary.averageOutSeconds,
    goalMetDays: summary.goalMetDays,
    trackedDays: summary.trackedDays,
  };
}

export function createShareProgressSnapshot(
  source: StatisticsSnapshot | null,
  capturedAt: number,
): ShareProgressSnapshot | null {
  if (source === null) {
    return null;
  }

  const statistics = createStatisticsReadModel(source, capturedAt);
  const currentDateStart = getLocalDayStart(capturedAt);
  const today = statistics.recentDays.find(
    (day) => day.dateStart === currentDateStart,
  );

  if (!today) {
    throw new Error('Share Progress requires a current treatment day.');
  }

  return {
    capturedAt,
    currentTray: copySummary(statistics.currentTray),
    currentTrayNumber: statistics.currentTreatment.currentTrayNumber,
    dailyWearGoalMinutes: statistics.currentTreatment.dailyWearGoalMinutes,
    daysPerTray: statistics.currentTreatment.daysPerTray,
    recentDays: statistics.recentDays.slice(0, 7),
    today: {
      inSeconds: today.inSeconds,
      outSeconds: today.outSeconds,
    },
    totalTrays: statistics.currentTreatment.totalTrays,
    trayDay: calculateTrayDay(
      statistics.currentTreatment.currentTrayStartedAt,
      capturedAt,
    ),
    treatmentOverall: copySummary(statistics.treatmentOverall),
  };
}
