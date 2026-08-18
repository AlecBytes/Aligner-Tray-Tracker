import type { SQLiteDatabase } from 'expo-sqlite';

import type { WearStatus } from '@/db/schema';

type ActiveTrayRow = {
  active_period_count: number;
  current_status: WearStatus | null;
  current_timestamp: number | null;
  total_trays: number;
  treatment_id: number;
};

export type ChangeTrayInput = {
  currentTrayPeriodId: number;
  trayNumber: number;
};

export type ChangeTrayResult = {
  currentTrayOutPunchId: number | null;
  timestamp: number;
  trayNumber: number;
  trayPeriodId: number;
  wearPunchId: number;
};

export class InvalidTrayNumberError extends Error {
  constructor(totalTrays: number) {
    super(`Tray number must be between 1 and ${totalTrays}.`);
    this.name = 'InvalidTrayNumberError';
  }
}

export class TrayChangeConflictError extends Error {
  constructor() {
    super('The active tray changed before the tray change could be saved.');
    this.name = 'TrayChangeConflictError';
  }
}

export async function changeTray(
  db: SQLiteDatabase,
  input: ChangeTrayInput,
  timestamp = Date.now(),
) {
  let changedTray: ChangeTrayResult | null = null;

  await db.withTransactionAsync(async () => {
    const activeTray = await db.getFirstAsync<ActiveTrayRow>(
      `SELECT
         tray_periods.treatment_id,
         treatment_plan_versions.total_trays,
         (
           SELECT COUNT(*)
           FROM tray_periods AS active_periods
           WHERE active_periods.treatment_id = tray_periods.treatment_id
             AND active_periods.ended_at IS NULL
         ) AS active_period_count,
         (
           SELECT wear_punches.status
           FROM wear_punches
           WHERE wear_punches.tray_period_id = tray_periods.id
           ORDER BY wear_punches.timestamp DESC, wear_punches.id DESC
           LIMIT 1
         ) AS current_status,
         (
           SELECT wear_punches.timestamp
           FROM wear_punches
           WHERE wear_punches.tray_period_id = tray_periods.id
           ORDER BY wear_punches.timestamp DESC, wear_punches.id DESC
           LIMIT 1
         ) AS current_timestamp
       FROM tray_periods
       JOIN treatment_plan_versions
         ON treatment_plan_versions.id = (
           SELECT plan.id
           FROM treatment_plan_versions AS plan
           WHERE plan.treatment_id = tray_periods.treatment_id
           ORDER BY plan.effective_at DESC, plan.id DESC
           LIMIT 1
         )
       WHERE tray_periods.id = ? AND tray_periods.ended_at IS NULL
       LIMIT 1`,
      input.currentTrayPeriodId,
    );

    if (
      activeTray === null ||
      activeTray.active_period_count !== 1 ||
      activeTray.current_status === null ||
      activeTray.current_timestamp === null ||
      timestamp <= activeTray.current_timestamp
    ) {
      throw new TrayChangeConflictError();
    }

    if (
      !Number.isSafeInteger(input.trayNumber) ||
      input.trayNumber < 1 ||
      input.trayNumber > activeTray.total_trays
    ) {
      throw new InvalidTrayNumberError(activeTray.total_trays);
    }

    let currentTrayOutPunchId: number | null = null;

    if (activeTray.current_status === 'IN') {
      const currentTrayOutPunch = await db.runAsync(
        `INSERT INTO wear_punches (tray_period_id, status, timestamp)
         VALUES (?, ?, ?)`,
        input.currentTrayPeriodId,
        'OUT',
        timestamp,
      );
      currentTrayOutPunchId = currentTrayOutPunch.lastInsertRowId;
    }

    const endedTray = await db.runAsync(
      `UPDATE tray_periods
       SET ended_at = ?
       WHERE id = ? AND ended_at IS NULL`,
      timestamp,
      input.currentTrayPeriodId,
    );

    if (endedTray.changes !== 1) {
      throw new TrayChangeConflictError();
    }

    const newTrayPeriod = await db.runAsync(
      `INSERT INTO tray_periods (treatment_id, tray_number, started_at)
       VALUES (?, ?, ?)`,
      activeTray.treatment_id,
      input.trayNumber,
      timestamp,
    );
    const newTrayWearPunch = await db.runAsync(
      `INSERT INTO wear_punches (tray_period_id, status, timestamp)
       VALUES (?, ?, ?)`,
      newTrayPeriod.lastInsertRowId,
      'OUT',
      timestamp,
    );

    changedTray = {
      currentTrayOutPunchId,
      timestamp,
      trayNumber: input.trayNumber,
      trayPeriodId: newTrayPeriod.lastInsertRowId,
      wearPunchId: newTrayWearPunch.lastInsertRowId,
    };
  });

  if (changedTray === null) {
    throw new Error('Tray change did not complete.');
  }

  return changedTray as ChangeTrayResult;
}
