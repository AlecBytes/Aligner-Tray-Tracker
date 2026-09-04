import type { SQLiteDatabase } from 'expo-sqlite';

import type { TreatmentPlanVersion } from '@/db/schema';
import { withUserMutationTransaction } from '@/db/mutation-transaction';
import {
  prescribedHoursToMinutes,
  type TreatmentPlanInput,
  type TreatmentSetupInput,
} from '@/features/treatment/treatment-model';

type TreatmentPlanVersionRow = {
  created_at: number;
  daily_wear_goal_minutes: number;
  days_per_tray: number;
  effective_at: number;
  id: number;
  total_trays: number;
  treatment_id: number;
};

function mapTreatmentPlanVersion(row: TreatmentPlanVersionRow): TreatmentPlanVersion {
  return {
    createdAt: row.created_at,
    dailyWearGoalMinutes: row.daily_wear_goal_minutes,
    daysPerTray: row.days_per_tray,
    effectiveAt: row.effective_at,
    id: row.id,
    totalTrays: row.total_trays,
    treatmentId: row.treatment_id,
  };
}

export async function hasTreatment(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ treatment_exists: number }>(
    'SELECT 1 AS treatment_exists FROM treatments LIMIT 1',
  );

  return row?.treatment_exists === 1;
}

export async function getCurrentTreatmentPlan(
  db: SQLiteDatabase,
): Promise<TreatmentPlanVersion | null> {
  const row = await db.getFirstAsync<TreatmentPlanVersionRow>(
    `SELECT
       id,
       treatment_id,
       total_trays,
       days_per_tray,
       daily_wear_goal_minutes,
       effective_at,
       created_at
     FROM treatment_plan_versions
     ORDER BY effective_at DESC, id DESC
     LIMIT 1`,
  );

  return row === null ? null : mapTreatmentPlanVersion(row);
}

export async function getTreatmentPlanHistory(
  db: SQLiteDatabase,
): Promise<TreatmentPlanVersion[]> {
  const rows = await db.getAllAsync<TreatmentPlanVersionRow>(
    `SELECT
       id,
       treatment_id,
       total_trays,
       days_per_tray,
       daily_wear_goal_minutes,
       effective_at,
       created_at
     FROM treatment_plan_versions
     ORDER BY effective_at DESC, id DESC`,
  );

  return rows.map(mapTreatmentPlanVersion);
}

export async function getActiveTrayNumber(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ tray_number: number }>(
    `SELECT tray_number
     FROM tray_periods
     WHERE ended_at IS NULL
     ORDER BY started_at DESC, id DESC
     LIMIT 1`,
  );

  return row?.tray_number ?? null;
}

export async function createTreatmentPlanVersion(
  db: SQLiteDatabase,
  input: TreatmentPlanInput,
  timestamp = Date.now(),
): Promise<TreatmentPlanVersion> {
  const currentPlan = await getCurrentTreatmentPlan(db);

  if (currentPlan === null) {
    throw new Error('No treatment plan exists.');
  }

  const dailyWearGoalMinutes = prescribedHoursToMinutes(input.prescribedHoursPerDay);
  const result = await db.runAsync(
    `INSERT INTO treatment_plan_versions (
      treatment_id,
      total_trays,
      days_per_tray,
      daily_wear_goal_minutes,
      effective_at,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    currentPlan.treatmentId,
    input.totalTrays,
    input.daysPerTray,
    dailyWearGoalMinutes,
    timestamp,
    timestamp,
  );

  if (result.changes !== 1) {
    throw new Error('Treatment plan version creation did not complete.');
  }

  return {
    createdAt: timestamp,
    dailyWearGoalMinutes,
    daysPerTray: input.daysPerTray,
    effectiveAt: timestamp,
    id: result.lastInsertRowId,
    totalTrays: input.totalTrays,
    treatmentId: currentPlan.treatmentId,
  };
}

export type InitialTreatmentRecordIds = {
  treatmentId: number;
  treatmentPlanVersionId: number;
  trayPeriodId: number;
  wearPunchId: number;
};

export async function createInitialTreatment(
  db: SQLiteDatabase,
  input: TreatmentSetupInput,
  timestamp = Date.now(),
) {
  let createdRecords: InitialTreatmentRecordIds | null = null;

  await withUserMutationTransaction(db, async (transaction) => {
    const existingTreatment = await transaction.getFirstAsync<{ treatment_exists: number }>(
      'SELECT 1 AS treatment_exists FROM treatments LIMIT 1',
    );

    if (existingTreatment?.treatment_exists === 1) {
      throw new Error('A treatment has already been created.');
    }

    const treatment = await transaction.runAsync(
      'INSERT INTO treatments (created_at) VALUES (?)',
      timestamp,
    );
    const treatmentId = treatment.lastInsertRowId;

    const plan = await transaction.runAsync(
      `INSERT INTO treatment_plan_versions (
        treatment_id,
        total_trays,
        days_per_tray,
        daily_wear_goal_minutes,
        effective_at,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      treatmentId,
      input.totalTrays,
      input.daysPerTray,
      prescribedHoursToMinutes(input.prescribedHoursPerDay),
      timestamp,
      timestamp,
    );

    const trayPeriod = await transaction.runAsync(
      `INSERT INTO tray_periods (treatment_id, tray_number, started_at)
       VALUES (?, ?, ?)`,
      treatmentId,
      input.startingTrayNumber,
      timestamp,
    );

    const wearPunch = await transaction.runAsync(
      `INSERT INTO wear_punches (tray_period_id, status, timestamp)
       VALUES (?, ?, ?)`,
      trayPeriod.lastInsertRowId,
      'IN',
      timestamp,
    );

    createdRecords = {
      treatmentId,
      treatmentPlanVersionId: plan.lastInsertRowId,
      trayPeriodId: trayPeriod.lastInsertRowId,
      wearPunchId: wearPunch.lastInsertRowId,
    };
  });

  if (createdRecords === null) {
    throw new Error('Treatment creation did not complete.');
  }

  return createdRecords as InitialTreatmentRecordIds;
}
