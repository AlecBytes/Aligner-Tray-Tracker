import type { SQLiteDatabase } from 'expo-sqlite';

import type { WearStatus } from '@/db/schema';
import type {
  StatisticsPlanVersion,
  StatisticsSnapshot,
  StatisticsTrayPeriod,
  StatisticsWearPunch,
} from '@/features/statistics/statistics-model';

type ActiveTreatmentRow = {
  treatment_id: number;
};

type StatisticsPlanVersionRow = {
  daily_wear_goal_minutes: number;
  days_per_tray: number;
  effective_at: number;
  id: number;
  total_trays: number;
};

type StatisticsTrayPeriodRow = {
  ended_at: number | null;
  id: number;
  started_at: number;
  tray_number: number;
};

type StatisticsWearPunchRow = {
  id: number;
  status: WearStatus;
  timestamp: number;
  tray_period_id: number;
};

function mapPlanVersion(row: StatisticsPlanVersionRow): StatisticsPlanVersion {
  return {
    dailyWearGoalMinutes: row.daily_wear_goal_minutes,
    daysPerTray: row.days_per_tray,
    effectiveAt: row.effective_at,
    id: row.id,
    totalTrays: row.total_trays,
  };
}

function mapTrayPeriod(row: StatisticsTrayPeriodRow): StatisticsTrayPeriod {
  return {
    endedAt: row.ended_at,
    id: row.id,
    startedAt: row.started_at,
    trayNumber: row.tray_number,
  };
}

function mapWearPunch(row: StatisticsWearPunchRow): StatisticsWearPunch {
  return {
    id: row.id,
    status: row.status,
    timestamp: row.timestamp,
    trayPeriodId: row.tray_period_id,
  };
}

export async function getStatisticsSnapshot(
  db: SQLiteDatabase,
): Promise<StatisticsSnapshot | null> {
  const activeTreatment = await db.getFirstAsync<ActiveTreatmentRow>(
    `SELECT treatment_id
     FROM tray_periods
     WHERE ended_at IS NULL
     ORDER BY started_at DESC, id DESC
     LIMIT 1`,
  );

  if (activeTreatment === null) {
    return null;
  }

  const [planRows, trayPeriodRows, punchRows] = await Promise.all([
    db.getAllAsync<StatisticsPlanVersionRow>(
      `SELECT id, total_trays, days_per_tray, daily_wear_goal_minutes, effective_at
       FROM treatment_plan_versions
       WHERE treatment_id = ?
       ORDER BY effective_at, id`,
      activeTreatment.treatment_id,
    ),
    db.getAllAsync<StatisticsTrayPeriodRow>(
      `SELECT id, tray_number, started_at, ended_at
       FROM tray_periods
       WHERE treatment_id = ?
       ORDER BY started_at, id`,
      activeTreatment.treatment_id,
    ),
    db.getAllAsync<StatisticsWearPunchRow>(
      `SELECT wear_punches.id, wear_punches.tray_period_id,
              wear_punches.status, wear_punches.timestamp
       FROM wear_punches
       JOIN tray_periods ON tray_periods.id = wear_punches.tray_period_id
       WHERE tray_periods.treatment_id = ?
       ORDER BY wear_punches.timestamp, wear_punches.id`,
      activeTreatment.treatment_id,
    ),
  ]);

  return {
    planVersions: planRows.map(mapPlanVersion),
    punches: punchRows.map(mapWearPunch),
    trayPeriods: trayPeriodRows.map(mapTrayPeriod),
  };
}
