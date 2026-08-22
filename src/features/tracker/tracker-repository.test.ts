import type { SQLiteDatabase } from 'expo-sqlite';

import {
  getTrackerSnapshot,
  redoWearStatus,
  toggleWearStatus,
  TrackerStateChangedError,
  undoWearStatus,
} from '@/features/tracker/tracker-repository';
import type { TrackerToggleAction } from '@/features/tracker/tracker-model';

function databaseWithRunAsync(runAsync: jest.Mock) {
  return { runAsync } as unknown as SQLiteDatabase;
}

const toggleAction: TrackerToggleAction = {
  predecessor: { id: 90, status: 'IN', timestamp: 900 },
  punch: { id: 91, status: 'OUT', timestamp: 1000 },
  trayPeriodId: 33,
};

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
      currentStatus,
      timestamp,
      33,
    );
  });

  it('rejects a stale expected state without returning an unpersisted toggle', async () => {
    const runAsync = jest.fn().mockResolvedValue({ changes: 0, lastInsertRowId: 0 });

    await expect(toggleWearStatus(databaseWithRunAsync(runAsync), 33, 'IN')).rejects.toBeInstanceOf(
      TrackerStateChangedError,
    );
  });

  it('requires the new punch to be later than the saved punch', async () => {
    const runAsync = jest.fn().mockResolvedValue({ changes: 0, lastInsertRowId: 0 });

    await expect(
      toggleWearStatus(databaseWithRunAsync(runAsync), 33, 'IN', 1000),
    ).rejects.toBeInstanceOf(TrackerStateChangedError);

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('latest_punch.timestamp < ?'),
      33,
      'OUT',
      1000,
      33,
      'IN',
      1000,
      33,
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

describe('undoWearStatus', () => {
  it('deletes the exact latest toggle while preserving its predecessor', async () => {
    const runAsync = jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 0 });

    await expect(undoWearStatus(databaseWithRunAsync(runAsync), toggleAction)).resolves.toBe(
      undefined,
    );

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM wear_punches'),
      91,
      33,
      'OUT',
      1000,
      33,
      33,
      90,
      33,
      'IN',
      900,
      33,
      91,
    );
    expect(runAsync.mock.calls[0][0]).toContain('ended_at IS NULL');
    expect(runAsync.mock.calls[0][0]).toContain('WHERE tray_period_id = ? AND id <> ?');
  });

  it.each([
    'the target is no longer latest',
    'the tray period is inactive',
    'the predecessor anchor is missing',
  ])('rejects when %s', async () => {
    const runAsync = jest.fn().mockResolvedValue({ changes: 0, lastInsertRowId: 0 });

    await expect(
      undoWearStatus(databaseWithRunAsync(runAsync), toggleAction),
    ).rejects.toBeInstanceOf(TrackerStateChangedError);
  });
});

describe('redoWearStatus', () => {
  it('restores the undone status and timestamp with a fresh row ID', async () => {
    const runAsync = jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 92 });

    await expect(redoWearStatus(databaseWithRunAsync(runAsync), toggleAction)).resolves.toEqual({
      id: 92,
      status: 'OUT',
      timestamp: 1000,
    });

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO wear_punches'),
      33,
      'OUT',
      1000,
      33,
      90,
      33,
      'IN',
      900,
      33,
      'IN',
      'OUT',
      900,
      1000,
    );
    expect(runAsync.mock.calls[0][0]).toContain('ended_at IS NULL');
    expect(runAsync.mock.calls[0][0]).toContain('ORDER BY timestamp DESC, id DESC');
  });

  it.each([
    'the predecessor is no longer latest',
    'the tray period is inactive',
    'the restored timestamp conflicts with the timeline',
  ])('rejects when %s', async () => {
    const runAsync = jest.fn().mockResolvedValue({ changes: 0, lastInsertRowId: 0 });

    await expect(
      redoWearStatus(databaseWithRunAsync(runAsync), toggleAction),
    ).rejects.toBeInstanceOf(TrackerStateChangedError);
  });
});
