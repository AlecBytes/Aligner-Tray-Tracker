import { createShareProgressSnapshot } from '@/features/share-progress/share-progress-model';
import type { StatisticsSnapshot } from '@/features/statistics/statistics-model';

const HOUR_IN_SECONDS = 60 * 60;

function at(day: number, hour = 0) {
  return new Date(2026, 7, day, hour).getTime();
}

function sourceSnapshot(): StatisticsSnapshot {
  return {
    planVersions: [
      {
        dailyWearGoalMinutes: 22 * 60,
        daysPerTray: 7,
        effectiveAt: at(20),
        id: 1,
        totalTrays: 48,
      },
      {
        dailyWearGoalMinutes: 21 * 60,
        daysPerTray: 10,
        effectiveAt: at(26, 12),
        id: 2,
        totalTrays: 52,
      },
    ],
    punches: [
      { id: 1, status: 'IN', timestamp: at(20), trayPeriodId: 1 },
      { id: 2, status: 'OUT', timestamp: at(26, 21), trayPeriodId: 3 },
      { id: 3, status: 'IN', timestamp: at(27), trayPeriodId: 3 },
    ],
    trayPeriods: [
      { endedAt: at(23), id: 1, startedAt: at(20), trayNumber: 8 },
      { endedAt: at(26), id: 2, startedAt: at(23), trayNumber: 9 },
      { endedAt: null, id: 3, startedAt: at(26), trayNumber: 8 },
    ],
  };
}

describe('createShareProgressSnapshot', () => {
  it('maps one Statistics read model with current plan, repeated tray, and today data', () => {
    const result = createShareProgressSnapshot(sourceSnapshot(), at(27, 12));

    expect(result).toMatchObject({
      capturedAt: at(27, 12),
      currentTrayNumber: 8,
      dailyWearGoalMinutes: 21 * 60,
      daysPerTray: 10,
      today: {
        inSeconds: 12 * HOUR_IN_SECONDS,
        outSeconds: 0,
      },
      totalTrays: 52,
      trayDay: 2,
    });
    expect(result?.recentDays).toHaveLength(7);
    expect(result?.recentDays[0].dateStart).toBe(at(27));
    expect(result?.recentDays[1]).toMatchObject({
      dateStart: at(26),
      goalMet: false,
      inSeconds: 21 * HOUR_IN_SECONDS,
    });
  });

  it('returns null when the repository has no active snapshot', () => {
    expect(createShareProgressSnapshot(null, at(27, 12))).toBeNull();
  });

  it('propagates invalid Statistics history errors instead of fabricating content', () => {
    const invalidSource = { ...sourceSnapshot(), planVersions: [] };

    expect(() => createShareProgressSnapshot(invalidSource, at(27, 12))).toThrow(
      'Treatment history has no plan effective for a tracked day.',
    );
  });
});
