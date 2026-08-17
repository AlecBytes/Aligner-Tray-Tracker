import type { SQLiteDatabase } from 'expo-sqlite';

import {
  getTrackerSnapshot,
  toggleWearStatus,
  TrackerStateChangedError,
} from '@/features/tracker/tracker-repository';

function databaseWithRunAsync(runAsync: jest.Mock) {
  return { runAsync } as unknown as SQLiteDatabase;
}

describe('getTrackerSnapshot', () => {
  it('loads the active tray, prior state, and current-day punches', async () => {
    const now = new Date(2026, 7, 15, 12).getTime();
    const dayStart = new Date(2026, 7, 15).getTime();
    const getFirstAsync = jest
      .fn()
      .mockResolvedValueOnce({
        current_tray_number: 9,
        days_per_tray: 7,
        total_trays: 48,
        tray_period_id: 33,
        tray_started_at: new Date(2026, 7, 11, 9).getTime(),
        treatment_id: 12,
      })
      .mockResolvedValueOnce({ id: 80, status: 'IN', timestamp: dayStart - 1000 });
    const getAllAsync = jest.fn().mockResolvedValue([
      { id: 81, status: 'OUT', timestamp: dayStart + 60_000 },
      { id: 82, status: 'IN', timestamp: dayStart + 120_000 },
    ]);
    const db = { getAllAsync, getFirstAsync } as unknown as SQLiteDatabase;

    await expect(getTrackerSnapshot(db, now)).resolves.toEqual({
      currentTrayNumber: 9,
      daysPerTray: 7,
      punches: [
        { id: 80, status: 'IN', timestamp: dayStart - 1000 },
        { id: 81, status: 'OUT', timestamp: dayStart + 60_000 },
        { id: 82, status: 'IN', timestamp: dayStart + 120_000 },
      ],
      totalTrays: 48,
      trayPeriodId: 33,
      trayStartedAt: new Date(2026, 7, 11, 9).getTime(),
    });
    expect(getFirstAsync.mock.calls[0][0]).toContain(
      'ORDER BY plan.effective_at DESC, plan.id DESC',
    );
  });
});

describe('toggleWearStatus', () => {
  it.each([
    ['IN', 'OUT'],
    ['OUT', 'IN'],
  ] as const)('persists %s → %s before returning the new state', async (currentStatus, nextStatus) => {
    const timestamp = 1_755_250_000_000;
    const runAsync = jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 91 });

    await expect(
      toggleWearStatus(databaseWithRunAsync(runAsync), 33, currentStatus, timestamp),
    ).resolves.toEqual({ id: 91, status: nextStatus, timestamp });

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO wear_punches'),
      33,
      nextStatus,
      timestamp,
      33,
      33,
      currentStatus,
    );
  });

  it('rejects a stale expected state without returning an unpersisted toggle', async () => {
    const runAsync = jest.fn().mockResolvedValue({ changes: 0, lastInsertRowId: 0 });

    await expect(toggleWearStatus(databaseWithRunAsync(runAsync), 33, 'IN')).rejects.toBeInstanceOf(
      TrackerStateChangedError,
    );
  });

  it('allows only one of two rapid toggles with the same expected state', async () => {
    const runAsync = jest
      .fn()
      .mockResolvedValueOnce({ changes: 1, lastInsertRowId: 91 })
      .mockResolvedValueOnce({ changes: 0, lastInsertRowId: 0 });
    const db = databaseWithRunAsync(runAsync);
    const results = await Promise.allSettled([
      toggleWearStatus(db, 33, 'IN', 1000),
      toggleWearStatus(db, 33, 'IN', 1001),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  });
});
