import {
  formatBriefShare,
  formatDetailedShare,
  formatShareProgress,
  formatSummaryShare,
} from '@/features/share-progress/share-progress-formatters';
import type { ShareProgressSnapshot } from '@/features/share-progress/share-progress-model';

const HOUR_IN_SECONDS = 60 * 60;

function at(day: number, hour = 0, minute = 0) {
  return new Date(2026, 7, day, hour, minute).getTime();
}

function snapshot(): ShareProgressSnapshot {
  return {
    capturedAt: at(26, 20),
    currentTray: {
      averageInSeconds: 21 * HOUR_IN_SECONDS + 31 * 60,
      averageOutSeconds: 2 * HOUR_IN_SECONDS + 29 * 60,
      goalMetDays: 4,
      trackedDays: 5,
    },
    currentTrayNumber: 9,
    dailyWearGoalMinutes: 22 * 60,
    daysPerTray: 7,
    recentDays: [
      {
        dateStart: at(26),
        goalMet: false,
        inSeconds: 20 * HOUR_IN_SECONDS + 17 * 60,
        outSeconds: HOUR_IN_SECONDS + 42 * 60,
      },
      {
        dateStart: at(25),
        goalMet: true,
        inSeconds: 22 * HOUR_IN_SECONDS + 11 * 60,
        outSeconds: HOUR_IN_SECONDS + 49 * 60,
      },
      {
        dateStart: at(24),
        goalMet: false,
        inSeconds: 21 * HOUR_IN_SECONDS + 46 * 60,
        outSeconds: 2 * HOUR_IN_SECONDS + 14 * 60,
      },
    ],
    today: {
      inSeconds: 20 * HOUR_IN_SECONDS + 17 * 60,
      outSeconds: HOUR_IN_SECONDS + 42 * 60,
    },
    totalTrays: 48,
    trayDay: 5,
    treatmentOverall: {
      averageInSeconds: 21 * HOUR_IN_SECONDS + 18 * 60,
      averageOutSeconds: 2 * HOUR_IN_SECONDS + 42 * 60,
      goalMetDays: 61,
      trackedDays: 73,
    },
  };
}

describe('Share Progress formatters', () => {
  it('formats the exact Brief report', () => {
    expect(formatBriefShare(snapshot())).toBe(
      ['Aligner progress: Tray 9 of 48, Day 5.', '20h 17m IN today.'].join('\n'),
    );
  });

  it('formats the exact Summary report', () => {
    expect(formatSummaryShare(snapshot())).toBe(
      [
        'Aligner Tracker',
        '',
        'Current tray: 9 of 48',
        'Tray day: 5',
        'Today: 20h 17m IN, 1h 42m OUT',
        'Daily goal: 22h',
        '',
        'Current tray average: 21h 31m IN/day',
        'Goal met: 4 of 5 tracked days',
      ].join('\n'),
    );
  });

  it('formats the exact Detailed report with local dates and current-day status', () => {
    expect(formatDetailedShare(snapshot(), 'en-US')).toBe(
      [
        'Aligner Tracker Progress',
        '',
        'CURRENT TREATMENT',
        'Tray: 9 of 48',
        'Tray day: 5',
        'Schedule: 7 days/tray',
        'Daily wear goal: 22h',
        '',
        'TODAY',
        'IN: 20h 17m',
        'OUT: 1h 42m',
        '',
        'CURRENT TRAY',
        'Average IN: 21h 31m/day',
        'Average OUT: 2h 29m/day',
        'Goal met: 4 of 5 tracked days',
        '',
        'TREATMENT OVERALL',
        'Average IN: 21h 18m/day',
        'Average OUT: 2h 42m/day',
        'Goal met: 61 of 73 tracked days',
        '',
        'RECENT DAYS',
        'Aug 26 — 20h 17m IN / 1h 42m OUT — In progress',
        'Aug 25 — 22h 11m IN / 1h 49m OUT — Goal met',
        'Aug 24 — 21h 46m IN / 2h 14m OUT — Goal not met',
      ].join('\n'),
    );
  });

  it('caps recent days at seven and orders them newest first', () => {
    const value = snapshot();
    value.recentDays = Array.from({ length: 8 }, (_, index) => ({
      dateStart: at(index + 1),
      goalMet: true,
      inSeconds: 0,
      outSeconds: 0,
    }));

    const recentSection = formatDetailedShare(value, 'en-US').split('RECENT DAYS\n')[1];
    const recentLines = recentSection.split('\n');

    expect(recentLines).toHaveLength(7);
    expect(recentLines[0]).toContain('Aug 8');
    expect(recentLines[6]).toContain('Aug 2');
    expect(recentSection).not.toContain('Aug 1');
  });

  it('dispatches every content level to its matching formatter', () => {
    const value = snapshot();

    expect(formatShareProgress(value, 'brief')).toBe(formatBriefShare(value));
    expect(formatShareProgress(value, 'summary')).toBe(formatSummaryShare(value));
    expect(formatShareProgress(value, 'detailed', 'en-US')).toBe(
      formatDetailedShare(value, 'en-US'),
    );
  });
});
