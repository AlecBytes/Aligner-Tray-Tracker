import type { SQLiteDatabase } from 'expo-sqlite';

import { getStatisticsSnapshot } from '@/features/statistics/statistics-repository';

describe('getStatisticsSnapshot', () => {
  it('maps plan, tray-period, and punch history for the active treatment', async () => {
    const getFirstAsync = jest.fn().mockResolvedValue({ treatment_id: 42 });
    const getAllAsync = jest.fn(async (sql: string, _treatmentId: number) => {
      if (sql.includes('FROM treatment_plan_versions')) {
        return [
          { daily_wear_goal_minutes: 1320, effective_at: 100, id: 1 },
          { daily_wear_goal_minutes: 1260, effective_at: 300, id: 2 },
        ];
      }

      if (sql.includes('FROM tray_periods')) {
        return [
          { ended_at: 250, id: 10, started_at: 100, tray_number: 8 },
          { ended_at: null, id: 11, started_at: 250, tray_number: 9 },
        ];
      }

      return [
        { id: 20, status: 'IN', timestamp: 100, tray_period_id: 10 },
        { id: 21, status: 'OUT', timestamp: 250, tray_period_id: 11 },
      ];
    });
    const db = { getAllAsync, getFirstAsync } as unknown as SQLiteDatabase;

    await expect(getStatisticsSnapshot(db)).resolves.toEqual({
      planVersions: [
        { dailyWearGoalMinutes: 1320, effectiveAt: 100, id: 1 },
        { dailyWearGoalMinutes: 1260, effectiveAt: 300, id: 2 },
      ],
      punches: [
        { id: 20, status: 'IN', timestamp: 100, trayPeriodId: 10 },
        { id: 21, status: 'OUT', timestamp: 250, trayPeriodId: 11 },
      ],
      trayPeriods: [
        { endedAt: 250, id: 10, startedAt: 100, trayNumber: 8 },
        { endedAt: null, id: 11, startedAt: 250, trayNumber: 9 },
      ],
    });
    expect(getAllAsync).toHaveBeenCalledTimes(3);
    expect(getAllAsync.mock.calls.every((call) => call[1] === 42)).toBe(true);
  });

  it('returns no statistics history when there is no active treatment', async () => {
    const getFirstAsync = jest.fn().mockResolvedValue(null);
    const getAllAsync = jest.fn();
    const db = { getAllAsync, getFirstAsync } as unknown as SQLiteDatabase;

    await expect(getStatisticsSnapshot(db)).resolves.toBeNull();
    expect(getAllAsync).not.toHaveBeenCalled();
  });
});
