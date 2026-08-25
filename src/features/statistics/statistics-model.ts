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

export const STATISTICS_GRAPH_KINDS = [
  'wear-time',
  'goal-progress',
  'tray-progress',
] as const;

export type StatisticsGraphKind = (typeof STATISTICS_GRAPH_KINDS)[number];

export const STATISTICS_GRAPH_RANGES = ['7-days', '30-days', 'treatment'] as const;

export type StatisticsGraphRange = (typeof STATISTICS_GRAPH_RANGES)[number];

export type DailyStatisticsGraphPoint = {
  dateStart: number;
  goalDifferenceSeconds: number;
  goalMet: boolean;
  goalSeconds: number;
  inSeconds: number;
};

export type TrayPeriodStatisticsGraphPoint = {
  durationSeconds: number;
  endedAt: number;
  id: number;
  isActive: boolean;
  label: string;
  startedAt: number;
  trayNumber: number;
};

export type StatisticsGraphReadModel = {
  dailyPoints: DailyStatisticsGraphPoint[];
  rangeEndedAt: number;
  rangeStartedAt: number;
  trayPeriods: TrayPeriodStatisticsGraphPoint[];
};
