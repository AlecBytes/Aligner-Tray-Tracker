import type { SQLiteDatabase } from 'expo-sqlite';

import type { WearStatus } from '@/db/schema';
import {
  CorrectionValidationError,
  planMissingWearPeriod,
  validateEditedPunchTimestamp,
} from '@/features/edit-times/edit-times-corrections';
import type {
  EditableWearPunch,
  MissingPeriodInput,
  TrayPeriodWindow,
} from '@/features/edit-times/edit-times-model';

type TreatmentStartRow = {
  treatment_started_at: number;
};

type WearPunchRow = {
  id: number;
  status: WearStatus;
  timestamp: number;
  tray_period_id: number;
};

type WearPunchWithPeriodRow = WearPunchRow & {
  ended_at: number | null;
  started_at: number;
};

type TrayPeriodRow = {
  ended_at: number | null;
  id: number;
  started_at: number;
};

export class CorrectionConflictError extends Error {
  constructor() {
    super('Punch history changed before the correction could be saved. Please try again.');
    this.name = 'CorrectionConflictError';
  }
}

function mapWearPunch(row: WearPunchRow): EditableWearPunch {
  return {
    id: row.id,
    status: row.status,
    timestamp: row.timestamp,
    trayPeriodId: row.tray_period_id,
  };
}

function mapTrayPeriod(row: TrayPeriodRow): TrayPeriodWindow {
  return { endedAt: row.ended_at, id: row.id, startedAt: row.started_at };
}

async function getTrayPeriodPunches(db: SQLiteDatabase, trayPeriodId: number) {
  const rows = await db.getAllAsync<WearPunchRow>(
    `SELECT id, tray_period_id, status, timestamp
     FROM wear_punches
     WHERE tray_period_id = ?
     ORDER BY timestamp, id`,
    trayPeriodId,
  );
  return rows.map(mapWearPunch);
}

export async function getTreatmentHistoryStart(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<TreatmentStartRow>(
    `SELECT MIN(history.started_at) AS treatment_started_at
     FROM tray_periods AS active
     JOIN tray_periods AS history ON history.treatment_id = active.treatment_id
     WHERE active.ended_at IS NULL`,
  );
  return row?.treatment_started_at ?? null;
}

export async function getWearPunchesForDay(
  db: SQLiteDatabase,
  dayStart: number,
  nextDayStart: number,
) {
  const rows = await db.getAllAsync<WearPunchRow>(
    `SELECT wear_punches.id, wear_punches.tray_period_id,
            wear_punches.status, wear_punches.timestamp
     FROM wear_punches
     JOIN tray_periods ON tray_periods.id = wear_punches.tray_period_id
     WHERE tray_periods.treatment_id = (
       SELECT treatment_id
       FROM tray_periods
       WHERE ended_at IS NULL
       ORDER BY started_at DESC, id DESC
       LIMIT 1
     )
       AND wear_punches.timestamp >= ?
       AND wear_punches.timestamp < ?
     ORDER BY wear_punches.timestamp, wear_punches.id`,
    dayStart,
    nextDayStart,
  );
  return rows.map(mapWearPunch);
}

export async function getWearPunchForEdit(db: SQLiteDatabase, punchId: number) {
  const row = await db.getFirstAsync<WearPunchWithPeriodRow>(
    `SELECT wear_punches.id, wear_punches.tray_period_id,
            wear_punches.status, wear_punches.timestamp,
            tray_periods.started_at, tray_periods.ended_at
     FROM wear_punches
     JOIN tray_periods ON tray_periods.id = wear_punches.tray_period_id
     WHERE wear_punches.id = ?
     LIMIT 1`,
    punchId,
  );

  if (row === null) {
    return null;
  }

  return {
    period: mapTrayPeriod({
      ended_at: row.ended_at,
      id: row.tray_period_id,
      started_at: row.started_at,
    }),
    punch: mapWearPunch(row),
  };
}

export async function updateWearPunchTimestamp(
  db: SQLiteDatabase,
  punchId: number,
  newTimestamp: number,
) {
  let correctedPunch: EditableWearPunch | null = null;

  await db.withTransactionAsync(async () => {
    const row = await db.getFirstAsync<WearPunchWithPeriodRow>(
      `SELECT wear_punches.id, wear_punches.tray_period_id,
              wear_punches.status, wear_punches.timestamp,
              tray_periods.started_at, tray_periods.ended_at
       FROM wear_punches
       JOIN tray_periods ON tray_periods.id = wear_punches.tray_period_id
       WHERE wear_punches.id = ?
       LIMIT 1`,
      punchId,
    );

    if (row === null) {
      throw new CorrectionConflictError();
    }

    const period = mapTrayPeriod({
      ended_at: row.ended_at,
      id: row.tray_period_id,
      started_at: row.started_at,
    });
    const punches = await getTrayPeriodPunches(db, period.id);
    validateEditedPunchTimestamp(period, punches, punchId, newTimestamp);

    const result = await db.runAsync(
      `UPDATE wear_punches
       SET timestamp = ?
       WHERE id = ? AND tray_period_id = ? AND timestamp = ?`,
      newTimestamp,
      punchId,
      period.id,
      row.timestamp,
    );

    if (result.changes !== 1) {
      throw new CorrectionConflictError();
    }

    correctedPunch = { ...mapWearPunch(row), timestamp: newTimestamp };
  });

  if (correctedPunch === null) {
    throw new CorrectionConflictError();
  }

  return correctedPunch as EditableWearPunch;
}

export async function addMissingWearPeriod(
  db: SQLiteDatabase,
  input: MissingPeriodInput,
) {
  let insertedPunches: EditableWearPunch[] | null = null;

  await db.withTransactionAsync(async () => {
    const periodRows = await db.getAllAsync<TrayPeriodRow>(
      `SELECT id, started_at, ended_at
       FROM tray_periods
       WHERE treatment_id = (
         SELECT treatment_id
         FROM tray_periods
         WHERE ended_at IS NULL
         ORDER BY started_at DESC, id DESC
         LIMIT 1
       )
         AND started_at <= ?
         AND (ended_at IS NULL OR ended_at >= ?)
       ORDER BY started_at DESC, id DESC`,
      input.startTimestamp,
      input.endTimestamp,
    );

    if (periodRows.length !== 1) {
      throw new CorrectionValidationError(
        'The missing time must stay within one valid tray period.',
      );
    }

    const period = mapTrayPeriod(periodRows[0]);
    const punches = await getTrayPeriodPunches(db, period.id);
    const plannedPunches = planMissingWearPeriod(period, punches, input);
    const created: EditableWearPunch[] = [];

    for (const punch of plannedPunches) {
      const result = await db.runAsync(
        `INSERT INTO wear_punches (tray_period_id, status, timestamp)
         VALUES (?, ?, ?)`,
        period.id,
        punch.status,
        punch.timestamp,
      );
      created.push({
        id: result.lastInsertRowId,
        status: punch.status,
        timestamp: punch.timestamp,
        trayPeriodId: period.id,
      });
    }

    insertedPunches = created;
  });

  if (insertedPunches === null) {
    throw new CorrectionConflictError();
  }

  return insertedPunches as EditableWearPunch[];
}

