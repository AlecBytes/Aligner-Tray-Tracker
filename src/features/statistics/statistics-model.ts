import type { WearStatus } from '@/db/schema';

export type StatisticsPlanVersion = {
  dailyWearGoalMinutes: number;
  effectiveAt: number;
  id: number;
};

export type StatisticsTrayPeriod = {
  endedAt: number | null;
  id: number;
  startedAt: number;
  trayNumber: number;
};

export type StatisticsWearPunch = {
  id: number;
  status: WearStatus;
  timestamp: number;
  trayPeriodId: number;
};

export type StatisticsSnapshot = {
  planVersions: StatisticsPlanVersion[];
  punches: StatisticsWearPunch[];
  trayPeriods: StatisticsTrayPeriod[];
};

export type StatisticsSummary = {
  averageInSeconds: number;
  averageOutSeconds: number;
  goalMetDays: number;
  trackedDays: number;
};

export type CurrentTrayStatistics = StatisticsSummary & {
  daysWorn: number;
};

export type RecentTreatmentDay = {
  dateStart: number;
  goalMet: boolean;
  inSeconds: number;
  outSeconds: number;
};

export type StatisticsReadModel = {
  currentTray: CurrentTrayStatistics;
  recentDays: RecentTreatmentDay[];
  treatmentOverall: StatisticsSummary;
};
