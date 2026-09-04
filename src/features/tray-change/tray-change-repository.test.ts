import type { SQLiteDatabase } from 'expo-sqlite';

import {
  changeTray,
  InvalidTrayNumberError,
  TrayChangeConflictError,
} from '@/features/tray-change/tray-change-repository';
import { toggleWearStatus } from '@/features/tracker/tracker-repository';

type DatabaseOptions = {
  currentStatus?: 'IN' | 'OUT';
  currentTimestamp?: number;
  totalTrays?: number;
};

function createDatabaseMock({
  currentStatus = 'OUT',
  currentTimestamp = 0,
  totalTrays = 48,
}: DatabaseOptions = {}) {
  let insideTransaction = false;
  const insertedIds = [101, 102, 103, 104];
  const getFirstAsync = jest.fn(
    async (): Promise<{
      active_period_count: number;
      current_status: 'IN' | 'OUT';
      current_timestamp: number;
      total_trays: number;
      treatment_id: number;
    } | null> => ({
      active_period_count: 1,
      current_status: currentStatus,
      current_timestamp: currentTimestamp,
      total_trays: totalTrays,
      treatment_id: 12,
    }),
  );
  const runAsync = jest.fn(async () => {
    expect(insideTransaction).toBe(true);
    return { changes: 1, lastInsertRowId: insertedIds.shift() ?? 0 };
  });
  const transaction = { getFirstAsync, runAsync } as unknown as SQLiteDatabase;
  const withExclusiveTransactionAsync = jest.fn(
    async (task: (transaction: SQLiteDatabase) => Promise<void>) => {
      insideTransaction = true;

      try {
        await task(transaction);
      } finally {
        insideTransaction = false;
      }
    },
  );

  return {
    db: { withExclusiveTransactionAsync } as unknown as SQLiteDatabase,
    getFirstAsync,
    runAsync,
    withExclusiveTransactionAsync,
  };
}

describe('changeTray', () => {
  const timestamp = 1_755_250_000_000;

  it('ends an OUT tray and creates a fresh OUT tray period', async () => {
    const database = createDatabaseMock({ currentStatus: 'OUT' });

    await expect(
      changeTray(database.db, { currentTrayPeriodId: 33, trayNumber: 10 }, timestamp),
    ).resolves.toEqual({
      currentTrayOutPunchId: null,
      timestamp,
      trayNumber: 10,
      trayPeriodId: 102,
      wearPunchId: 103,
    });

    expect(database.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
    expect(database.runAsync.mock.calls).toEqual([
      [expect.stringContaining('UPDATE tray_periods'), timestamp, 33],
      [expect.stringContaining('INSERT INTO tray_periods'), 12, 10, timestamp],
      [expect.stringContaining('INSERT INTO wear_punches'), 102, 'OUT', timestamp],
    ]);
  });

  it('marks an IN tray OUT before creating the new OUT tray period', async () => {
    const database = createDatabaseMock({ currentStatus: 'IN' });

    await expect(
      changeTray(database.db, { currentTrayPeriodId: 33, trayNumber: 10 }, timestamp),
    ).resolves.toEqual({
      currentTrayOutPunchId: 101,
      timestamp,
      trayNumber: 10,
      trayPeriodId: 103,
      wearPunchId: 104,
    });

    expect(database.runAsync.mock.calls).toEqual([
      [expect.stringContaining('INSERT INTO wear_punches'), 33, 'OUT', timestamp],
      [expect.stringContaining('UPDATE tray_periods'), timestamp, 33],
      [expect.stringContaining('INSERT INTO tray_periods'), 12, 10, timestamp],
      [expect.stringContaining('INSERT INTO wear_punches'), 103, 'OUT', timestamp],
    ]);
  });

  it('creates a new period when returning to a previously used tray number', async () => {
    const database = createDatabaseMock();

    await changeTray(database.db, { currentTrayPeriodId: 33, trayNumber: 8 }, timestamp);

    expect(database.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO tray_periods'),
      12,
      8,
      timestamp,
    );
    expect(database.runAsync).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE tray_periods'),
      expect.anything(),
      8,
    );
  });

  it('rejects a tray outside the current plan without changing records', async () => {
    const database = createDatabaseMock({ totalTrays: 48 });

    await expect(
      changeTray(database.db, { currentTrayPeriodId: 33, trayNumber: 49 }, timestamp),
    ).rejects.toBeInstanceOf(InvalidTrayNumberError);
    expect(database.runAsync).not.toHaveBeenCalled();
  });

  it('rejects a duplicate request after its original tray period is no longer active', async () => {
    const database = createDatabaseMock();
    database.getFirstAsync.mockResolvedValueOnce(null);

    await expect(
      changeTray(database.db, { currentTrayPeriodId: 33, trayNumber: 10 }, timestamp),
    ).rejects.toBeInstanceOf(TrayChangeConflictError);
    expect(database.runAsync).not.toHaveBeenCalled();
  });

  it('rejects a tray change that would duplicate the latest punch timestamp', async () => {
    const database = createDatabaseMock({ currentStatus: 'IN', currentTimestamp: timestamp });

    await expect(
      changeTray(database.db, { currentTrayPeriodId: 33, trayNumber: 10 }, timestamp),
    ).rejects.toBeInstanceOf(TrayChangeConflictError);
    expect(database.runAsync).not.toHaveBeenCalled();
  });

  it('rolls back the ended tray and inserted records when a write fails', async () => {
    const state: {
      punches: {
        id: number;
        status: 'IN' | 'OUT';
        timestamp: number;
        trayPeriodId: number;
      }[];
      trayPeriods: {
        endedAt: number | null;
        id: number;
        startedAt: number;
        trayNumber: number;
      }[];
    } = {
      punches: [{ id: 80, status: 'IN', timestamp: timestamp - 1000, trayPeriodId: 33 }],
      trayPeriods: [
        { endedAt: null as number | null, id: 33, startedAt: timestamp - 10_000, trayNumber: 9 },
      ],
    };
    const originalState = JSON.parse(JSON.stringify(state));
    const getFirstAsync = jest.fn(async () => ({
      active_period_count: 1,
      current_status: 'IN',
      current_timestamp: timestamp - 1000,
      total_trays: 48,
      treatment_id: 12,
    }));
    const runAsync = jest.fn(async (sql: string, ...parameters: (number | string)[]) => {
      if (sql.includes('UPDATE tray_periods')) {
        state.trayPeriods[0].endedAt = parameters[0] as number;
        return { changes: 1, lastInsertRowId: 0 };
      }

      if (sql.includes('INSERT INTO tray_periods')) {
        state.trayPeriods.push({
          endedAt: null,
          id: 34,
          startedAt: parameters[2] as number,
          trayNumber: parameters[1] as number,
        });
        return { changes: 1, lastInsertRowId: 34 };
      }

      const trayPeriodId = parameters[0] as number;

      if (trayPeriodId === 34) {
        throw new Error('Simulated new-tray punch failure.');
      }

      state.punches.push({
        id: 81,
        status: 'OUT',
        timestamp: parameters[2] as number,
        trayPeriodId,
      });
      return { changes: 1, lastInsertRowId: 81 };
    });
    const transaction = { getFirstAsync, runAsync } as unknown as SQLiteDatabase;
    const withExclusiveTransactionAsync = jest.fn(
      async (task: (transaction: SQLiteDatabase) => Promise<void>) => {
        const beforeTransaction = JSON.parse(JSON.stringify(state));

        try {
          await task(transaction);
        } catch (error) {
          state.punches = beforeTransaction.punches;
          state.trayPeriods = beforeTransaction.trayPeriods;
          throw error;
        }
      },
    );
    const db = { withExclusiveTransactionAsync } as unknown as SQLiteDatabase;

    await expect(
      changeTray(db, { currentTrayPeriodId: 33, trayNumber: 10 }, timestamp),
    ).rejects.toThrow('Simulated new-tray punch failure.');
    expect(state).toEqual(originalState);
  });

  it('keeps a simultaneous tracker toggle outside the tray-change transaction', async () => {
    const state = {
      punches: [{ id: 80, status: 'OUT' as const, timestamp: timestamp - 1000, trayPeriodId: 33 }],
      trayPeriods: [
        {
          endedAt: null as number | null,
          id: 33,
          startedAt: timestamp - 10_000,
          trayNumber: 9,
          treatmentId: 12,
        },
      ],
    };
    let exclusiveWriteActive = false;
    let releaseWrite!: () => void;
    const writeStarted = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    let notifyWriteStarted!: () => void;
    const transactionReachedWrite = new Promise<void>((resolve) => {
      notifyWriteStarted = resolve;
    });
    const transactionGetFirstAsync = jest.fn(async () => ({
      active_period_count: 1,
      current_status: 'OUT' as const,
      current_timestamp: timestamp - 1000,
      total_trays: 48,
      treatment_id: 12,
    }));
    const transactionRunAsync = jest.fn(
      async (sql: string, ...parameters: (number | string)[]) => {
        if (sql.includes('UPDATE tray_periods')) {
          exclusiveWriteActive = true;
          state.trayPeriods[0].endedAt = parameters[0] as number;
          notifyWriteStarted();
          await writeStarted;
          return { changes: 1, lastInsertRowId: 0 };
        }

        if (sql.includes('INSERT INTO tray_periods')) {
          state.trayPeriods.push({
            endedAt: null,
            id: 34,
            startedAt: parameters[2] as number,
            trayNumber: parameters[1] as number,
            treatmentId: parameters[0] as number,
          });
          return { changes: 1, lastInsertRowId: 34 };
        }

        state.punches.push({
          id: 81,
          status: parameters[1] as 'OUT',
          timestamp: parameters[2] as number,
          trayPeriodId: parameters[0] as number,
        });
        return { changes: 1, lastInsertRowId: 81 };
      },
    );
    const transaction = {
      getFirstAsync: transactionGetFirstAsync,
      runAsync: transactionRunAsync,
    } as unknown as SQLiteDatabase;
    const rootRunAsync = jest.fn(async () => {
      if (exclusiveWriteActive) {
        throw new Error('database is locked');
      }
      return { changes: 0, lastInsertRowId: 0 };
    });
    const withExclusiveTransactionAsync = jest.fn(
      async (task: (transaction: SQLiteDatabase) => Promise<void>) => {
        try {
          await task(transaction);
        } finally {
          exclusiveWriteActive = false;
        }
      },
    );
    const db = { runAsync: rootRunAsync, withExclusiveTransactionAsync } as unknown as SQLiteDatabase;

    const trayChange = changeTray(db, { currentTrayPeriodId: 33, trayNumber: 10 }, timestamp);
    await transactionReachedWrite;

    await expect(toggleWearStatus(db, 33, 'OUT', timestamp + 1)).rejects.toThrow(
      'database is locked',
    );

    releaseWrite();
    await expect(trayChange).resolves.toMatchObject({ trayNumber: 10, trayPeriodId: 34 });

    expect(state.trayPeriods.filter((period) => period.endedAt === null)).toHaveLength(1);
    expect(state.trayPeriods.find((period) => period.endedAt === null)?.id).toBe(34);
    expect(state.punches.at(-1)).toMatchObject({ status: 'OUT', trayPeriodId: 34 });
  });
});
