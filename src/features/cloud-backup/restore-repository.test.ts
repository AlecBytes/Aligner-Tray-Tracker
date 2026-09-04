import type {
  SQLiteBindParams,
  SQLiteDatabase,
  SQLiteStatement,
} from 'expo-sqlite';

import type { BackupSnapshotEnvelopeV1 } from '@/features/cloud-backup/backup-snapshot';
import {
  importBackupSnapshot,
  isCloudRestoreEligible,
} from '@/features/cloud-backup/restore-repository';

type RestoreState = {
  appInstallation: string;
  plans: unknown[][];
  punches: unknown[][];
  settings: number[];
  treatments: unknown[][];
  trayPeriods: unknown[][];
};

function snapshot(): BackupSnapshotEnvelopeV1 {
  return {
    schemaVersion: 1,
    sourceAppVersion: '1.0.0',
    payload: {
      treatments: [{ id: 7, createdAt: 100 }],
      treatmentPlanVersions: [
        {
          id: 11,
          treatmentId: 7,
          totalTrays: 20,
          daysPerTray: 10,
          dailyWearGoalMinutes: 1_320,
          effectiveAt: 100,
          createdAt: 100,
        },
      ],
      trayPeriods: [
        { id: 21, treatmentId: 7, trayNumber: 2, startedAt: 100, endedAt: null },
      ],
      wearPunches: [
        { id: 31, trayPeriodId: 21, status: 'IN', timestamp: 100 },
        { id: 32, trayPeriodId: 21, status: 'OUT', timestamp: 200 },
      ],
      notificationSettings: {
        outReminderEnabled: false,
        outReminderMinutes: 60,
        outPersistentReminderIntervalMinutes: 10,
        trayChangeReminderEnabled: true,
        trayChangeReminderHour: 18,
        trayChangeReminderMinute: 30,
      },
    },
  };
}

function cloneState(state: RestoreState): RestoreState {
  return {
    appInstallation: state.appInstallation,
    plans: state.plans.map((row) => [...row]),
    punches: state.punches.map((row) => [...row]),
    settings: [...state.settings],
    treatments: state.treatments.map((row) => [...row]),
    trayPeriods: state.trayPeriods.map((row) => [...row]),
  };
}

function createRestoreDatabase(options: { failTable?: keyof RestoreState; trackerMissing?: boolean } = {}) {
  let state: RestoreState = {
    appInstallation: 'installation-kept',
    plans: [],
    punches: [],
    settings: [1, 45, 5, 1, 9, 0, 1],
    treatments: [],
    trayPeriods: [],
  };
  const finalized: string[] = [];

  const getFirstAsync = jest.fn(async (sql: string, ...parameters: unknown[]) => {
    if (sql.includes('SELECT COUNT(*) FROM treatments')) {
      return {
        plan_count: state.plans.length,
        punch_count: state.punches.length,
        treatment_count: state.treatments.length,
        tray_period_count: state.trayPeriods.length,
      };
    }
    if (sql.includes('FROM tray_periods') && sql.includes('current_tray_number')) {
      if (options.trackerMissing || state.trayPeriods.length === 0 || state.plans.length === 0) {
        return null;
      }
      const period = state.trayPeriods.at(-1)!;
      const plan = state.plans.at(-1)!;
      return {
        current_tray_number: period[2],
        days_per_tray: plan[3],
        total_trays: plan[2],
        tray_period_id: period[0],
        tray_started_at: period[3],
        treatment_id: period[1],
      };
    }
    if (sql.includes('FROM wear_punches')) {
      const before = Number(parameters[1]);
      const matching = state.punches.filter((row) => Number(row[3]) < before);
      const row = matching.at(-1);
      return row ? { id: row[0], status: row[2], timestamp: row[3] } : null;
    }
    throw new Error(`Unexpected getFirstAsync query: ${sql}`);
  });

  const getAllAsync = jest.fn(async (sql: string, ...parameters: unknown[]) => {
    if (sql.includes('FROM wear_punches')) {
      const start = Number(parameters[1]);
      const end = Number(parameters[2]);
      return state.punches
        .filter((row) => Number(row[3]) >= start && Number(row[3]) <= end)
        .map((row) => ({ id: row[0], status: row[2], timestamp: row[3] }));
    }
    throw new Error(`Unexpected getAllAsync query: ${sql}`);
  });

  function tableForSql(sql: string): keyof Pick<
    RestoreState,
    'plans' | 'punches' | 'treatments' | 'trayPeriods'
  > {
    if (sql.includes('treatment_plan_versions')) return 'plans';
    if (sql.includes('wear_punches')) return 'punches';
    if (sql.includes('tray_periods')) return 'trayPeriods';
    return 'treatments';
  }

  const prepareAsync = jest.fn(async (sql: string) => {
    const table = tableForSql(sql);
    return {
      executeAsync: jest.fn(async (parameters: SQLiteBindParams) => {
        if (options.failTable === table) throw new Error(`Injected ${table} failure`);
        state[table].push([...(parameters as unknown[])]);
        return { changes: 1, lastInsertRowId: Number((parameters as unknown[])[0]) };
      }),
      finalizeAsync: jest.fn(async () => {
        finalized.push(table);
      }),
    } as unknown as SQLiteStatement;
  });

  const runAsync = jest.fn(async (sql: string, ...parameters: unknown[]) => {
    if (!sql.includes('UPDATE settings')) throw new Error(`Unexpected runAsync query: ${sql}`);
    if (options.failTable === 'settings') throw new Error('Injected settings failure');
    state.settings = [...parameters.map(Number), state.settings[6]];
    return { changes: 1, lastInsertRowId: 0 };
  });

  const db = {
    getAllAsync,
    getFirstAsync,
    prepareAsync,
    runAsync,
    withExclusiveTransactionAsync: jest.fn(
      async (task: (transaction: SQLiteDatabase) => Promise<void>) => {
        const before = cloneState(state);
        try {
          await task(db as unknown as SQLiteDatabase);
        } catch (error) {
          state = before;
          throw error;
        }
      },
    ),
  } as unknown as SQLiteDatabase;

  return { db, finalized, get state() { return state; } };
}

describe('atomic backup restore repository', () => {
  it('requires every treatment table to be empty', async () => {
    const database = createRestoreDatabase();
    await expect(isCloudRestoreEligible(database.db)).resolves.toBe(true);
    database.state.punches.push([1, 1, 'IN', 100]);
    await expect(isCloudRestoreEligible(database.db)).resolves.toBe(false);
  });

  it('preserves IDs, restores settings, verifies the tracker, and keeps installation data', async () => {
    const database = createRestoreDatabase();
    await expect(importBackupSnapshot(database.db, snapshot(), 500)).resolves.toMatchObject({
      currentTrayNumber: 2,
      trayPeriodId: 21,
    });

    expect(database.state.treatments).toEqual([[7, 100]]);
    expect(database.state.plans[0]?.[0]).toBe(11);
    expect(database.state.trayPeriods[0]?.[0]).toBe(21);
    expect(database.state.punches.map((row) => row[0])).toEqual([31, 32]);
    expect(database.state.settings).toEqual([0, 60, 10, 1, 18, 30, 1]);
    expect(database.state.appInstallation).toBe('installation-kept');
    expect(database.finalized).toHaveLength(4);
  });

  it.each(['plans', 'trayPeriods', 'punches', 'settings'] as const)(
    'rolls back after a %s write failure',
    async (failTable) => {
      const database = createRestoreDatabase({ failTable });
      const before = cloneState(database.state);
      await expect(importBackupSnapshot(database.db, snapshot(), 500)).rejects.toThrow();
      expect(database.state).toEqual(before);
    },
  );

  it('rolls back when the imported tracker is unreadable', async () => {
    const database = createRestoreDatabase({ trackerMissing: true });
    const before = cloneState(database.state);
    await expect(importBackupSnapshot(database.db, snapshot(), 500)).rejects.toMatchObject({
      kind: 'import',
    });
    expect(database.state).toEqual(before);
  });

  it('stops inside the exclusive transaction if treatment data appears', async () => {
    const database = createRestoreDatabase();
    database.state.treatments.push([99, 99]);
    await expect(importBackupSnapshot(database.db, snapshot(), 500)).rejects.toMatchObject({
      kind: 'notEmpty',
    });
    expect(database.state.treatments).toEqual([[99, 99]]);
  });
});
