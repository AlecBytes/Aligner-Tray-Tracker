import { formatStatisticsDuration } from '@/features/statistics/statistics-calculations';
import type { RecentTreatmentDay } from '@/features/statistics/statistics-model';
import type {
  ShareProgressLevel,
  ShareProgressSnapshot,
} from '@/features/share-progress/share-progress-model';
import { getLocalDayStart } from '@/features/tracker/tracker-calculations';

function formatDailyGoal(minutes: number) {
  return formatStatisticsDuration(minutes * 60).replace(/ 0m$/, '');
}

function formatGoalCount(goalMetDays: number, trackedDays: number) {
  return `${goalMetDays} of ${trackedDays} tracked days`;
}

function formatRecentDay(
  day: RecentTreatmentDay,
  currentDateStart: number,
  dateFormatter: Intl.DateTimeFormat,
) {
  const goalStatus =
    day.dateStart === currentDateStart
      ? 'In progress'
      : day.goalMet
        ? 'Goal met'
        : 'Goal not met';

  return `${dateFormatter.format(day.dateStart)} — ${formatStatisticsDuration(day.inSeconds)} IN / ${formatStatisticsDuration(day.outSeconds)} OUT — ${goalStatus}`;
}

export function formatBriefShare(snapshot: ShareProgressSnapshot) {
  return [
    `Aligner progress: Tray ${snapshot.currentTrayNumber} of ${snapshot.totalTrays}, Day ${snapshot.trayDay}.`,
    `${formatStatisticsDuration(snapshot.today.inSeconds)} IN today.`,
  ].join('\n');
}

export function formatSummaryShare(snapshot: ShareProgressSnapshot) {
  return [
    'Aligner Tracker',
    '',
    `Current tray: ${snapshot.currentTrayNumber} of ${snapshot.totalTrays}`,
    `Tray day: ${snapshot.trayDay}`,
    `Today: ${formatStatisticsDuration(snapshot.today.inSeconds)} IN, ${formatStatisticsDuration(snapshot.today.outSeconds)} OUT`,
    `Daily goal: ${formatDailyGoal(snapshot.dailyWearGoalMinutes)}`,
    '',
    `Current tray average: ${formatStatisticsDuration(snapshot.currentTray.averageInSeconds)} IN/day`,
    `Goal met: ${formatGoalCount(snapshot.currentTray.goalMetDays, snapshot.currentTray.trackedDays)}`,
  ].join('\n');
}

export function formatDetailedShare(
  snapshot: ShareProgressSnapshot,
  locale?: Intl.LocalesArgument,
) {
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
  });
  const currentDateStart = getLocalDayStart(snapshot.capturedAt);
  const recentDays = snapshot.recentDays
    .slice()
    .sort((left, right) => right.dateStart - left.dateStart)
    .slice(0, 7)
    .map((day) => formatRecentDay(day, currentDateStart, dateFormatter));

  return [
    'Aligner Tracker Progress',
    '',
    'CURRENT TREATMENT',
    `Tray: ${snapshot.currentTrayNumber} of ${snapshot.totalTrays}`,
    `Tray day: ${snapshot.trayDay}`,
    `Schedule: ${snapshot.daysPerTray} days/tray`,
    `Daily wear goal: ${formatDailyGoal(snapshot.dailyWearGoalMinutes)}`,
    '',
    'TODAY',
    `IN: ${formatStatisticsDuration(snapshot.today.inSeconds)}`,
    `OUT: ${formatStatisticsDuration(snapshot.today.outSeconds)}`,
    '',
    'CURRENT TRAY',
    `Average IN: ${formatStatisticsDuration(snapshot.currentTray.averageInSeconds)}/day`,
    `Average OUT: ${formatStatisticsDuration(snapshot.currentTray.averageOutSeconds)}/day`,
    `Goal met: ${formatGoalCount(snapshot.currentTray.goalMetDays, snapshot.currentTray.trackedDays)}`,
    '',
    'TREATMENT OVERALL',
    `Average IN: ${formatStatisticsDuration(snapshot.treatmentOverall.averageInSeconds)}/day`,
    `Average OUT: ${formatStatisticsDuration(snapshot.treatmentOverall.averageOutSeconds)}/day`,
    `Goal met: ${formatGoalCount(snapshot.treatmentOverall.goalMetDays, snapshot.treatmentOverall.trackedDays)}`,
    '',
    'RECENT DAYS',
    ...recentDays,
  ].join('\n');
}

export function formatShareProgress(
  snapshot: ShareProgressSnapshot,
  level: ShareProgressLevel,
  locale?: Intl.LocalesArgument,
) {
  switch (level) {
    case 'brief':
      return formatBriefShare(snapshot);
    case 'summary':
      return formatSummaryShare(snapshot);
    case 'detailed':
      return formatDetailedShare(snapshot, locale);
  }
}
