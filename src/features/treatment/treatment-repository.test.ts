import type { SQLiteDatabase } from 'expo-sqlite';

import {
  createTreatmentPlanVersion,
  createInitialTreatment,
  getCurrentTreatmentPlan,
  hasTreatment,
} from '@/features/treatment/treatment-repository';

const SETUP_INPUT = {
  daysPerTray: 7,
  prescribedHoursPerDay: 22.5,
  startingTrayNumber: 9,
  totalTrays: 48,
};

function createDatabaseMock(existingTreatment = false) {
  let insideTransaction = false;
  const insertedIds = [101, 102, 103, 104];
  const getFirstAsync = jest.fn(async () =>
    existingTreatment ? { treatment_exists: 1 } : null,
  );
  const runAsync = jest.fn(async () => {
    expect(insideTransaction).toBe(true);
    return { changes: 1, lastInsertRowId: insertedIds.shift() ?? 0 };
  });
  const withTransactionAsync = jest.fn(async (task: () => Promise<void>) => {
    insideTransaction = true;

    try {
      await task();
    } finally {
      insideTransaction = false;
    }
  });

  return {
    db: { getFirstAsync, runAsync, withTransactionAsync } as unknown as SQLiteDatabase,
    getFirstAsync,
    runAsync,
    withTransactionAsync,
  };
}

describe('createInitialTreatment', () => {
  it('creates the initial records in one transaction with one timestamp', async () => {
    const database = createDatabaseMock();
    const timestamp = 1_754_000_000_000;

    await expect(createInitialTreatment(database.db, SETUP_INPUT, timestamp)).resolves.toEqual({
      treatmentId: 101,
      treatmentPlanVersionId: 102,
      trayPeriodId: 103,
      wearPunchId: 104,
    });

    expect(database.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(database.getFirstAsync).toHaveBeenCalledWith(
      'SELECT 1 AS treatment_exists FROM treatments LIMIT 1',
    );
    expect(database.runAsync).toHaveBeenCalledTimes(4);

    expect(database.runAsync.mock.calls[0]).toEqual([
      'INSERT INTO treatments (created_at) VALUES (?)',
      timestamp,
    ]);
    expect(database.runAsync.mock.calls[1]).toEqual([
      expect.stringContaining('INSERT INTO treatment_plan_versions'),
      101,
      48,
      7,
      1350,
      timestamp,
      timestamp,
    ]);
    expect(database.runAsync.mock.calls[2]).toEqual([
      expect.stringContaining('INSERT INTO tray_periods'),
      101,
      9,
      timestamp,
    ]);
    expect(database.runAsync.mock.calls[3]).toEqual([
      expect.stringContaining('INSERT INTO wear_punches'),
      103,
      'IN',
      timestamp,
    ]);
  });

  it('does not create another treatment when one already exists', async () => {
    const database = createDatabaseMock(true);

    await expect(createInitialTreatment(database.db, SETUP_INPUT)).rejects.toThrow(
      'A treatment has already been created.',
    );

    expect(database.withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(database.runAsync).not.toHaveBeenCalled();
  });
});

describe('hasTreatment', () => {
  it('reports whether setup has created a treatment record', async () => {
    const withoutTreatment = createDatabaseMock();
    const withTreatment = createDatabaseMock(true);

    await expect(hasTreatment(withoutTreatment.db)).resolves.toBe(false);
    await expect(hasTreatment(withTreatment.db)).resolves.toBe(true);
  });
});

type PlanVersionRow = {
  created_at: number;
  daily_wear_goal_minutes: number;
  days_per_tray: number;
  effective_at: number;
  id: number;
  total_trays: number;
  treatment_id: number;
};

const ORIGINAL_PLAN: PlanVersionRow = {
  created_at: 1_754_000_000_000,
  daily_wear_goal_minutes: 1320,
  days_per_tray: 7,
  effective_at: 1_754_000_000_000,
  id: 201,
  total_trays: 48,
  treatment_id: 101,
};

function createPlanDatabaseMock(
  initialVersions: PlanVersionRow[],
  options: { failWrite?: boolean } = {},
) {
  const versions = initialVersions.map((version) => ({ ...version }));
  const getFirstAsync = jest.fn(async (sql: string) => {
    expect(sql).toContain('FROM treatment_plan_versions');

    return (
      [...versions].sort(
        (left, right) => right.effective_at - left.effective_at || right.id - left.id,
      )[0] ?? null
    );
  });
  const runAsync = jest.fn(async (sql: string, ...params: number[]) => {
    expect(sql).toContain('INSERT INTO treatment_plan_versions');

    if (options.failWrite) {
      throw new Error('write failed');
    }

    const [
      treatmentId,
      totalTrays,
      daysPerTray,
      dailyWearGoalMinutes,
      effectiveAt,
      createdAt,
    ] = params;
    const id = Math.max(0, ...versions.map((version) => version.id)) + 1;
    versions.push({
      created_at: createdAt,
      daily_wear_goal_minutes: dailyWearGoalMinutes,
      days_per_tray: daysPerTray,
      effective_at: effectiveAt,
      id,
      total_trays: totalTrays,
      treatment_id: treatmentId,
    });

    return { changes: 1, lastInsertRowId: id };
  });

  return {
    db: { getFirstAsync, runAsync } as unknown as SQLiteDatabase,
    getFirstAsync,
    runAsync,
    versions,
  };
}

describe('getCurrentTreatmentPlan', () => {
  it('loads only the latest treatment plan version', async () => {
    const newerPlan = {
      ...ORIGINAL_PLAN,
      created_at: ORIGINAL_PLAN.created_at + 1000,
      days_per_tray: 10,
      effective_at: ORIGINAL_PLAN.effective_at + 1000,
      id: 202,
    };
    const database = createPlanDatabaseMock([ORIGINAL_PLAN, newerPlan]);

    await expect(getCurrentTreatmentPlan(database.db)).resolves.toEqual({
      createdAt: newerPlan.created_at,
      dailyWearGoalMinutes: newerPlan.daily_wear_goal_minutes,
      daysPerTray: 10,
      effectiveAt: newerPlan.effective_at,
      id: 202,
      totalTrays: newerPlan.total_trays,
      treatmentId: newerPlan.treatment_id,
    });
    expect(database.getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY effective_at DESC, id DESC'),
    );
  });
});

describe('createTreatmentPlanVersion', () => {
  it('saves a new version with one timestamp and preserves the previous version', async () => {
    const database = createPlanDatabaseMock([ORIGINAL_PLAN]);
    const timestamp = ORIGINAL_PLAN.created_at + 5000;

    await expect(
      createTreatmentPlanVersion(
        database.db,
        { daysPerTray: 10, prescribedHoursPerDay: 22.5, totalTrays: 52 },
        timestamp,
      ),
    ).resolves.toEqual({
      createdAt: timestamp,
      dailyWearGoalMinutes: 1350,
      daysPerTray: 10,
      effectiveAt: timestamp,
      id: 202,
      totalTrays: 52,
      treatmentId: 101,
    });

    expect(database.versions).toHaveLength(2);
    expect(database.versions[0]).toEqual(ORIGINAL_PLAN);
    expect(database.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO treatment_plan_versions'),
      101,
      52,
      10,
      1350,
      timestamp,
      timestamp,
    );
    await expect(getCurrentTreatmentPlan(database.db)).resolves.toMatchObject({
      daysPerTray: 10,
      id: 202,
      totalTrays: 52,
    });
  });

  it('leaves the previous plan active when the new version cannot be written', async () => {
    const database = createPlanDatabaseMock([ORIGINAL_PLAN], { failWrite: true });

    await expect(
      createTreatmentPlanVersion(database.db, {
        daysPerTray: 10,
        prescribedHoursPerDay: 22,
        totalTrays: 52,
      }),
    ).rejects.toThrow('write failed');

    expect(database.versions).toEqual([ORIGINAL_PLAN]);
    await expect(getCurrentTreatmentPlan(database.db)).resolves.toMatchObject({
      daysPerTray: 7,
      id: 201,
      totalTrays: 48,
    });
  });
});
