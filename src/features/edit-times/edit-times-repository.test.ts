import type { SQLiteDatabase } from 'expo-sqlite';

import {
  addMissingWearPeriod,
  deleteWearPunch,
  getWearPunchForEdit,
  updateWearPunchTimestamp,
} from '@/features/edit-times/edit-times-repository';
import { toggleWearStatus } from '@/features/tracker/tracker-repository';

type PunchState = {
  id: number;
  status: 'IN' | 'OUT';
  timestamp: number;
  trayPeriodId: number;
};

type PauseFirstInsert = {
  release: Promise<void>;
  started: () => void;
};

function createCorrectionDatabase(options?: {
  deleteChanges?: number;
  failSecondInsert?: boolean;
  pauseFirstInsert?: PauseFirstInsert;
  punches?: PunchState[];
}) {
  const period = { endedAt: 1000, id: 33, startedAt: 0 };
  const state: { punches: PunchState[] } = {
    punches: (options?.punches ?? [
      { id: 1, status: 'IN', timestamp: 100, trayPeriodId: period.id },
      { id: 2, status: 'OUT', timestamp: 800, trayPeriodId: period.id },
    ]).map((punch) => ({ ...punch })),
  };
  let insideExclusiveTransaction = false;
  let nextId = 3;
  let insertCount = 0;

  const readFirst = async (sql: string, punchId: number) => {
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
  };

  const readAll = async (sql: string, ...parameters: number[]) => {
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
  };

  const write = async (sql: string, ...parameters: (number | string)[]) => {
    if (sql.includes('DELETE FROM wear_punches')) {
      const [trayPeriodId, ...punchParameters] = parameters;
      const expectedPunches: { id: number; status: string; timestamp: number }[] = [];

      for (let index = 0; index < punchParameters.length; index += 3) {
        expectedPunches.push({
          id: punchParameters[index] as number,
          status: punchParameters[index + 1] as string,
          timestamp: punchParameters[index + 2] as number,
        });
      }

      const matchingPunches = state.punches.filter(
        (savedPunch) =>
          savedPunch.trayPeriodId === trayPeriodId &&
          expectedPunches.some(
            (expectedPunch) =>
              expectedPunch.id === savedPunch.id &&
              expectedPunch.status === savedPunch.status &&
              expectedPunch.timestamp === savedPunch.timestamp,
          ),
      );
      const punchesToDelete = matchingPunches.slice(
        0,
        options?.deleteChanges ?? matchingPunches.length,
      );
      const deletedIds = new Set(punchesToDelete.map((punch) => punch.id));
      state.punches = state.punches.filter((punch) => !deletedIds.has(punch.id));
      return { changes: punchesToDelete.length, lastInsertRowId: 0 };
    }

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

    if (insertCount === 1 && options?.pauseFirstInsert) {
      options.pauseFirstInsert.started();
      await options.pauseFirstInsert.release;
    }

    return { changes: 1, lastInsertRowId: id };
  };

  const transactionGetFirstAsync = jest.fn(readFirst);
  const transactionGetAllAsync = jest.fn(readAll);
  const transactionRunAsync = jest.fn(write);
  const rootGetFirstAsync = jest.fn(async (...args: Parameters<typeof readFirst>) => {
    if (insideExclusiveTransaction) {
      throw new Error('Shared connection read entered an exclusive mutation.');
    }
    return readFirst(...args);
  });
  const rootGetAllAsync = jest.fn(async (...args: Parameters<typeof readAll>) => {
    if (insideExclusiveTransaction) {
      throw new Error('Shared connection read entered an exclusive mutation.');
    }
    return readAll(...args);
  });
  const rootRunAsync = jest.fn(async () => {
    if (insideExclusiveTransaction) {
      throw new Error('database is locked');
    }
    throw new Error('Unexpected shared-connection write.');
  });
  const transaction = {
    getAllAsync: transactionGetAllAsync,
    getFirstAsync: transactionGetFirstAsync,
    runAsync: transactionRunAsync,
  } as unknown as SQLiteDatabase;
  const withExclusiveTransactionAsync = jest.fn(
    async (task: (transaction: SQLiteDatabase) => Promise<void>) => {
      const beforeTransaction = state.punches.map((punch) => ({ ...punch }));
      insideExclusiveTransaction = true;

      try {
        await task(transaction);
      } catch (error) {
        state.punches = beforeTransaction;
        throw error;
      } finally {
        insideExclusiveTransaction = false;
      }
    },
  );

  return {
    db: {
      getAllAsync: rootGetAllAsync,
      getFirstAsync: rootGetFirstAsync,
      runAsync: rootRunAsync,
      withExclusiveTransactionAsync,
    } as unknown as SQLiteDatabase,
    period,
    runAsync: transactionRunAsync,
    state,
    withExclusiveTransactionAsync,
  };
}

describe('Edit In/Out Times persistence', () => {
  it('edits a punch timestamp in an exclusive transaction', async () => {
    const database = createCorrectionDatabase();

    await expect(updateWearPunchTimestamp(database.db, 2, 700)).resolves.toEqual({
      id: 2,
      status: 'OUT',
      timestamp: 700,
      trayPeriodId: 33,
    });

    expect(database.state.punches.find((punch) => punch.id === 2)?.timestamp).toBe(700);
    expect(database.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
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
    expect(database.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
  });

  it('deletes an interior state interval in one transaction', async () => {
    const punches: PunchState[] = [
      { id: 1, status: 'IN', timestamp: 100, trayPeriodId: 33 },
      { id: 2, status: 'OUT', timestamp: 300, trayPeriodId: 33 },
      { id: 3, status: 'IN', timestamp: 400, trayPeriodId: 33 },
      { id: 4, status: 'OUT', timestamp: 800, trayPeriodId: 33 },
    ];
    const database = createCorrectionDatabase({ punches });
    const editablePunch = await getWearPunchForEdit(database.db, 2);

    expect(editablePunch?.deletionPlan).not.toBeNull();
    await expect(
      deleteWearPunch(database.db, editablePunch!.deletionPlan!),
    ).resolves.toEqual([punches[1], punches[2]]);

    expect(database.state.punches).toEqual([punches[0], punches[3]]);
    expect(database.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM wear_punches'),
      33,
      2,
      'OUT',
      300,
      3,
      'IN',
      400,
    );
    expect(database.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
  });

  it('deletes only the final event in its tray period', async () => {
    const database = createCorrectionDatabase();
    const editablePunch = await getWearPunchForEdit(database.db, 2);

    await expect(
      deleteWearPunch(database.db, editablePunch!.deletionPlan!),
    ).resolves.toEqual([
      { id: 2, status: 'OUT', timestamp: 800, trayPeriodId: 33 },
    ]);
    expect(database.state.punches).toEqual([
      { id: 1, status: 'IN', timestamp: 100, trayPeriodId: 33 },
    ]);
  });

  it('does not offer a deletion plan for the first punch', async () => {
    const database = createCorrectionDatabase();

    await expect(getWearPunchForEdit(database.db, 1)).resolves.toMatchObject({
      deletionPlan: null,
    });
  });

  it('rejects deletion when the confirmed neighboring event is stale', async () => {
    const punches: PunchState[] = [
      { id: 1, status: 'IN', timestamp: 100, trayPeriodId: 33 },
      { id: 2, status: 'OUT', timestamp: 300, trayPeriodId: 33 },
      { id: 3, status: 'IN', timestamp: 400, trayPeriodId: 33 },
      { id: 4, status: 'OUT', timestamp: 800, trayPeriodId: 33 },
    ];
    const database = createCorrectionDatabase({ punches });
    const editablePunch = await getWearPunchForEdit(database.db, 2);
    const stalePlan = {
      ...editablePunch!.deletionPlan!,
      followingPunch: {
        ...editablePunch!.deletionPlan!.followingPunch!,
        timestamp: 401,
      },
    };

    await expect(deleteWearPunch(database.db, stalePlan)).rejects.toThrow(
      'Punch history changed',
    );
    expect(database.state.punches).toEqual(punches);
  });

  it('rolls back a partial pair deletion', async () => {
    const punches: PunchState[] = [
      { id: 1, status: 'IN', timestamp: 100, trayPeriodId: 33 },
      { id: 2, status: 'OUT', timestamp: 300, trayPeriodId: 33 },
      { id: 3, status: 'IN', timestamp: 400, trayPeriodId: 33 },
      { id: 4, status: 'OUT', timestamp: 800, trayPeriodId: 33 },
    ];
    const database = createCorrectionDatabase({ deleteChanges: 1, punches });
    const editablePunch = await getWearPunchForEdit(database.db, 2);

    await expect(
      deleteWearPunch(database.db, editablePunch!.deletionPlan!),
    ).rejects.toThrow('Punch history changed');
    expect(database.state.punches).toEqual(punches);
  });

  it('keeps a simultaneous tracker toggle outside a punch-correction transaction', async () => {
    let releaseFirstInsert!: () => void;
    const release = new Promise<void>((resolve) => {
      releaseFirstInsert = resolve;
    });
    let notifyFirstInsert!: () => void;
    const firstInsertStarted = new Promise<void>((resolve) => {
      notifyFirstInsert = resolve;
    });
    const database = createCorrectionDatabase({
      pauseFirstInsert: {
        release,
        started: notifyFirstInsert,
      },
    });

    const correction = addMissingWearPeriod(database.db, {
      endTimestamp: 400,
      startTimestamp: 300,
      status: 'OUT',
    });
    await firstInsertStarted;

    await expect(toggleWearStatus(database.db, 33, 'OUT', 900)).rejects.toThrow(
      'database is locked',
    );

    releaseFirstInsert();
    await expect(correction).resolves.toHaveLength(2);

    expect(
      [...database.state.punches]
        .sort((left, right) => left.timestamp - right.timestamp)
        .map((punch) => punch.status),
    ).toEqual(['IN', 'OUT', 'IN', 'OUT']);
  });
});
