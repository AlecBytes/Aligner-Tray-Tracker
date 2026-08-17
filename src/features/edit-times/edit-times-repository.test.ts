import type { SQLiteDatabase } from 'expo-sqlite';

import {
  addMissingWearPeriod,
  updateWearPunchTimestamp,
} from '@/features/edit-times/edit-times-repository';

type PunchState = {
  id: number;
  status: 'IN' | 'OUT';
  timestamp: number;
  trayPeriodId: number;
};

function createCorrectionDatabase(options?: { failSecondInsert?: boolean }) {
  const period = { endedAt: 1000, id: 33, startedAt: 0 };
  const state: { punches: PunchState[] } = {
    punches: [
      { id: 1, status: 'IN', timestamp: 100, trayPeriodId: period.id },
      { id: 2, status: 'OUT', timestamp: 800, trayPeriodId: period.id },
    ],
  };
  let nextId = 3;
  let insertCount = 0;
  const getFirstAsync = jest.fn(async (sql: string, punchId: number) => {
    if (!sql.includes('WHERE wear_punches.id')) {
      return null;
    }

    const savedPunch = state.punches.find((punch) => punch.id === punchId);
    return savedPunch
      ? {
          ended_at: period.endedAt,
          id: savedPunch.id,
          started_at: period.startedAt,
          status: savedPunch.status,
          timestamp: savedPunch.timestamp,
          tray_period_id: savedPunch.trayPeriodId,
        }
      : null;
  });
  const getAllAsync = jest.fn(async (sql: string, ...parameters: number[]) => {
    if (sql.includes('SELECT id, started_at, ended_at')) {
      const [startTimestamp, endTimestamp] = parameters;
      return startTimestamp >= period.startedAt && endTimestamp <= period.endedAt
        ? [{ ended_at: period.endedAt, id: period.id, started_at: period.startedAt }]
        : [];
    }

    return state.punches
      .filter((punch) => punch.trayPeriodId === parameters[0])
      .sort((left, right) => left.timestamp - right.timestamp)
      .map((punch) => ({
        id: punch.id,
        status: punch.status,
        timestamp: punch.timestamp,
        tray_period_id: punch.trayPeriodId,
      }));
  });
  const runAsync = jest.fn(async (sql: string, ...parameters: (number | string)[]) => {
    if (sql.includes('UPDATE wear_punches')) {
      const [timestamp, punchId, trayPeriodId, previousTimestamp] = parameters as number[];
      const savedPunch = state.punches.find(
        (punch) =>
          punch.id === punchId &&
          punch.trayPeriodId === trayPeriodId &&
          punch.timestamp === previousTimestamp,
      );

      if (!savedPunch) {
        return { changes: 0, lastInsertRowId: 0 };
      }

      savedPunch.timestamp = timestamp;
      return { changes: 1, lastInsertRowId: 0 };
    }

    insertCount += 1;
    if (options?.failSecondInsert && insertCount === 2) {
      throw new Error('Simulated second insert failure.');
    }

    const [trayPeriodId, status, timestamp] = parameters as [number, 'IN' | 'OUT', number];
    const id = nextId;
    nextId += 1;
    state.punches.push({ id, status, timestamp, trayPeriodId });
    return { changes: 1, lastInsertRowId: id };
  });
  const withTransactionAsync = jest.fn(async (task: () => Promise<void>) => {
    const beforeTransaction = state.punches.map((punch) => ({ ...punch }));

    try {
      await task();
    } catch (error) {
      state.punches = beforeTransaction;
      throw error;
    }
  });

  return {
    db: { getAllAsync, getFirstAsync, runAsync, withTransactionAsync } as unknown as SQLiteDatabase,
    runAsync,
    state,
    withTransactionAsync,
  };
}

describe('Edit In/Out Times persistence', () => {
  it('edits a punch timestamp in a transaction', async () => {
    const database = createCorrectionDatabase();

    await expect(updateWearPunchTimestamp(database.db, 2, 700)).resolves.toEqual({
      id: 2,
      status: 'OUT',
      timestamp: 700,
      trayPeriodId: 33,
    });

    expect(database.state.punches.find((punch) => punch.id === 2)?.timestamp).toBe(700);
    expect(database.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(database.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE wear_punches'),
      700,
      2,
      33,
      800,
    );
  });

  it('inserts both transitions for a missing OUT period', async () => {
    const database = createCorrectionDatabase();

    await expect(
      addMissingWearPeriod(database.db, {
        endTimestamp: 400,
        startTimestamp: 300,
        status: 'OUT',
      }),
    ).resolves.toEqual([
      { id: 3, status: 'OUT', timestamp: 300, trayPeriodId: 33 },
      { id: 4, status: 'IN', timestamp: 400, trayPeriodId: 33 },
    ]);

    expect(database.runAsync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO wear_punches'),
      33,
      'OUT',
      300,
    );
    expect(database.runAsync).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO wear_punches'),
      33,
      'IN',
      400,
    );
  });

  it('rolls back the first transition when the second insert fails', async () => {
    const database = createCorrectionDatabase({ failSecondInsert: true });
    const originalPunches = database.state.punches.map((punch) => ({ ...punch }));

    await expect(
      addMissingWearPeriod(database.db, {
        endTimestamp: 400,
        startTimestamp: 300,
        status: 'OUT',
      }),
    ).rejects.toThrow('Simulated second insert failure.');

    expect(database.state.punches).toEqual(originalPunches);
    expect(database.withTransactionAsync).toHaveBeenCalledTimes(1);
  });
});

