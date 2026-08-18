import type { SQLiteDatabase } from 'expo-sqlite';

import type { WearStatus } from '@/db/schema';
import { getLocalDayStart } from '@/features/tracker/tracker-calculations';
import type { TrackerSnapshot, WearPunchEvent } from '@/features/tracker/tracker-model';

type CurrentTrackerRow = {
  current_tray_number: number;
  days_per_tray: number;
  total_trays: number;
  tray_period_id: number;
  tray_started_at: number;
  treatment_id: number;
};

type WearPunchRow = {
  id: number;
  status: WearStatus;
  timestamp: number;
};

export class TrackerStateChangedError extends Error {
  constructor() {
    super('The saved wear state changed before the toggle could be applied.');
    this.name = 'TrackerStateChangedError';
  }
}

function mapWearPunch(row: WearPunchRow): WearPunchEvent {
  return { id: row.id, status: row.status, timestamp: row.timestamp };
}

export async function getTrackerSnapshot(
  db: SQLiteDatabase,
  now = Date.now(),
): Promise<TrackerSnapshot | null> {
  const tracker = await db.getFirstAsync<CurrentTrackerRow>(
    `SELECT
       tray_periods.id AS tray_period_id,
       tray_periods.treatment_id,
       tray_periods.tray_number AS current_tray_number,
       tray_periods.started_at AS tray_started_at,
       treatment_plan_versions.total_trays,
       treatment_plan_versions.days_per_tray
     FROM tray_periods
     JOIN treatment_plan_versions
       ON treatment_plan_versions.id = (
         SELECT plan.id
         FROM treatment_plan_versions AS plan
         WHERE plan.treatment_id = tray_periods.treatment_id
         ORDER BY plan.effective_at DESC, plan.id DESC
         LIMIT 1
       )
     WHERE tray_periods.ended_at IS NULL
     ORDER BY tray_periods.started_at DESC, tray_periods.id DESC
     LIMIT 1`,
  );

  if (tracker === null) {
    return null;
  }

  const dayStart = getLocalDayStart(now);
  const priorPunch = await db.getFirstAsync<WearPunchRow>(
    `SELECT wear_punches.id, wear_punches.status, wear_punches.timestamp
     FROM wear_punches
     JOIN tray_periods ON tray_periods.id = wear_punches.tray_period_id
     WHERE tray_periods.treatment_id = ? AND wear_punches.timestamp < ?
     ORDER BY wear_punches.timestamp DESC, wear_punches.id DESC
     LIMIT 1`,
    tracker.treatment_id,
    dayStart,
  );
  const todayPunches = await db.getAllAsync<WearPunchRow>(
    `SELECT wear_punches.id, wear_punches.status, wear_punches.timestamp
     FROM wear_punches
     JOIN tray_periods ON tray_periods.id = wear_punches.tray_period_id
     WHERE tray_periods.treatment_id = ?
       AND wear_punches.timestamp >= ?
       AND wear_punches.timestamp <= ?
     ORDER BY wear_punches.timestamp, wear_punches.id`,
    tracker.treatment_id,
    dayStart,
    now,
  );
  const punches = [
    ...(priorPunch === null ? [] : [mapWearPunch(priorPunch)]),
    ...todayPunches.map(mapWearPunch),
  ];

  if (punches.length === 0) {
    throw new Error('Tracker has no wear punches.');
  }

  return {
    currentTrayNumber: tracker.current_tray_number,
    daysPerTray: tracker.days_per_tray,
    punches,
    totalTrays: tracker.total_trays,
    trayPeriodId: tracker.tray_period_id,
    trayStartedAt: tracker.tray_started_at,
  };
}

export async function toggleWearStatus(
  db: SQLiteDatabase,
  trayPeriodId: number,
  expectedStatus: WearStatus,
  timestamp = Date.now(),
): Promise<WearPunchEvent> {
  const nextStatus: WearStatus = expectedStatus === 'IN' ? 'OUT' : 'IN';
  const result = await db.runAsync(
    `INSERT INTO wear_punches (tray_period_id, status, timestamp)
     SELECT ?, ?, ?
     FROM (
       SELECT status, timestamp
       FROM wear_punches
       WHERE tray_period_id = ?
       ORDER BY timestamp DESC, id DESC
       LIMIT 1
     ) AS latest_punch
     WHERE latest_punch.status = ?
       AND latest_punch.timestamp < ?
       AND EXISTS (
         SELECT 1 FROM tray_periods WHERE id = ? AND ended_at IS NULL
       )`,
    trayPeriodId,
    nextStatus,
    timestamp,
    trayPeriodId,
    expectedStatus,
    timestamp,
    trayPeriodId,
  );

  if (result.changes !== 1) {
    throw new TrackerStateChangedError();
  }

  return {
    id: result.lastInsertRowId,
    status: nextStatus,
    timestamp,
  };
}
