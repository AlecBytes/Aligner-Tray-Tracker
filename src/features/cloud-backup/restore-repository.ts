import { getTrackerSnapshot } from '@/features/tracker/tracker-repository';
import { getTrackingMode, notifyTrackingChanged, type TrackingMode } from '@/features/retainer/retainer-repository';
import type {
  SQLiteBindParams,
  SQLiteDatabase,
  SQLiteStatement,
} from 'expo-sqlite';

import type { BackupSnapshotEnvelopeV1 } from '@/features/cloud-backup/backup-snapshot';
import { CloudRestoreOperationError } from '@/features/cloud-backup/cloud-restore-core';

type RestoreTableCounts = {
  plan_count: number;
  punch_count: number;
  treatment_count: number;
  tray_period_count: number;
  retainer_count: number;
};

export async function isCloudRestoreEligible(db: SQLiteDatabase) {
  const counts = await db.getFirstAsync<RestoreTableCounts>(
    `SELECT
       (SELECT COUNT(*) FROM retainer_periods) + (SELECT COUNT(*) FROM retainer_wear_punches) AS retainer_count,
       (SELECT COUNT(*) FROM treatments) AS treatment_count,
       (SELECT COUNT(*) FROM treatment_plan_versions) AS plan_count,
       (SELECT COUNT(*) FROM tray_periods) AS tray_period_count,
       (SELECT COUNT(*) FROM wear_punches) AS punch_count`,
  );

  return (
    counts !== null &&
    (counts.retainer_count ?? 0) === 0 &&
    counts.treatment_count === 0 &&
    counts.plan_count === 0 &&
    counts.tray_period_count === 0 &&
    counts.punch_count === 0
  );
}

async function finalizeStatements(statements: SQLiteStatement[]) {
  let failure: unknown;
  for (let index = statements.length - 1; index >= 0; index -= 1) {
    try {
      await statements[index].finalizeAsync();
    } catch (error) {
      failure ??= error;
    }
  }
  if (failure) throw failure;
}

async function requireSingleInsert(
  statement: SQLiteStatement,
  parameters: SQLiteBindParams,
) {
  const result = await statement.executeAsync(parameters);
  if (result.changes !== 1) throw new CloudRestoreOperationError('import');
}

export async function importBackupSnapshot(
  db: SQLiteDatabase,
  envelope: BackupSnapshotEnvelopeV1,
  _now = Date.now(),
) {
  let importedTracker: TrackingMode | null = null;
  await db.withExclusiveTransactionAsync(async (transaction) => {
    if (!(await isCloudRestoreEligible(transaction))) {
      throw new CloudRestoreOperationError('notEmpty');
    }

    const statements: SQLiteStatement[] = [];
    try {
      const treatmentStatement = await transaction.prepareAsync(
        'INSERT INTO treatments (id, created_at, completed_at) VALUES (?, ?, ?)',
      );
      statements.push(treatmentStatement);
      const planStatement = await transaction.prepareAsync(
        `INSERT INTO treatment_plan_versions (
           id,
           treatment_id,
           total_trays,
           days_per_tray,
           daily_wear_goal_minutes,
           effective_at,
           created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      );
      statements.push(planStatement);
      const periodStatement = await transaction.prepareAsync(
        `INSERT INTO tray_periods (
           id,
           treatment_id,
           tray_number,
           started_at,
           ended_at
         ) VALUES (?, ?, ?, ?, ?)`,
      );
      statements.push(periodStatement);
      const punchStatement = await transaction.prepareAsync(
        `INSERT INTO wear_punches (id, tray_period_id, status, timestamp)
         VALUES (?, ?, ?, ?)`,
      );
      statements.push(punchStatement);

      for (const treatment of envelope.payload.treatments) {
        await requireSingleInsert(treatmentStatement, [treatment.id, treatment.createdAt, treatment.completedAt ?? null]);
      }
      for (const plan of envelope.payload.treatmentPlanVersions) {
        await requireSingleInsert(planStatement, [
          plan.id,
          plan.treatmentId,
          plan.totalTrays,
          plan.daysPerTray,
          plan.dailyWearGoalMinutes,
          plan.effectiveAt,
          plan.createdAt,
        ]);
      }
      for (const period of envelope.payload.trayPeriods) {
        await requireSingleInsert(periodStatement, [
          period.id,
          period.treatmentId,
          period.trayNumber,
          period.startedAt,
          period.endedAt,
        ]);
      }
      for (const punch of envelope.payload.wearPunches) {
        await requireSingleInsert(punchStatement, [
          punch.id,
          punch.trayPeriodId,
          punch.status,
          punch.timestamp,
        ]);
      }

      const settings = envelope.payload.notificationSettings;
      const settingsResult = await transaction.runAsync(
        `UPDATE settings
         SET
           out_reminder_enabled = ?,
           out_reminder_minutes = ?,
           out_persistent_reminder_interval_minutes = ?,
           tray_change_reminder_enabled = ?,
           tray_change_reminder_hour = ?,
           tray_change_reminder_minute = ?,
           tray_change_overdue_reminder_enabled = ?
         WHERE id = 1`,
        settings.outReminderEnabled ? 1 : 0,
        settings.outReminderMinutes,
        settings.outPersistentReminderIntervalMinutes,
        settings.trayChangeReminderEnabled ? 1 : 0,
        settings.trayChangeReminderHour,
        settings.trayChangeReminderMinute,
        settings.trayChangeOverdueReminderEnabled === true ? 1 : 0,
      );
      if (settingsResult.changes !== 1) {
        throw new CloudRestoreOperationError('import');
      }

      const data = envelope.payload.retainerData;
      if (data) {
        for (const period of data.periods) await transaction.runAsync('INSERT INTO retainer_periods(id,treatment_id,started_at,ended_at) VALUES (?,?,?,?)', period.id,period.treatment_id,period.started_at,period.ended_at);
        for (const punch of data.punches) await transaction.runAsync('INSERT INTO retainer_wear_punches(id,retainer_period_id,status,timestamp,origin,auto_out_suppressed) VALUES (?,?,?,?,?,?)',punch.id,punch.retainer_period_id,punch.status,punch.timestamp,punch.origin,punch.auto_out_suppressed);
        const s = data.settings;
        await transaction.runAsync('UPDATE retainer_settings SET bedtime_enabled=?,bedtime_minutes=?,morning_enabled=?,morning_minutes=?,automatic_enabled=?,automatic_minutes=?,automatic_effective_at=? WHERE id=1',s.bedtime_enabled,s.bedtime_minutes,s.morning_enabled,s.morning_minutes,s.automatic_enabled,s.automatic_minutes,s.automatic_effective_at);
      }
      const tracker = await getTrackingMode(transaction);
      if (tracker.kind === 'treatment' && !(await getTrackerSnapshot(transaction, _now))) throw new CloudRestoreOperationError('import');
      if (tracker === null) throw new CloudRestoreOperationError('import');
      importedTracker = tracker;
    } finally {
      await finalizeStatements(statements);
    }
  });

  if (importedTracker === null) throw new CloudRestoreOperationError('import');
  notifyTrackingChanged();
  try {
    return (await getTrackingMode(db)) ?? importedTracker;
  } catch {
    // The transaction already verified operational state and committed. A
    // transient post-commit read must not misreport restored data as rollback.
    return importedTracker;
  }
}
