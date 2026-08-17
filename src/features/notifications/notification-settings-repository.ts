import type { SQLiteDatabase } from 'expo-sqlite';

import type { Settings } from '@/db/schema';

type SettingsRow = {
  out_reminder_enabled: number;
  out_reminder_minutes: number;
  tray_change_reminder_enabled: number;
  tray_change_reminder_hour: number;
  tray_change_reminder_minute: number;
};

function mapSettings(row: SettingsRow): Settings {
  return {
    outReminderEnabled: row.out_reminder_enabled === 1,
    outReminderMinutes: row.out_reminder_minutes,
    trayChangeReminderEnabled: row.tray_change_reminder_enabled === 1,
    trayChangeReminderHour: row.tray_change_reminder_hour,
    trayChangeReminderMinute: row.tray_change_reminder_minute,
  };
}

export async function getNotificationSettings(db: SQLiteDatabase): Promise<Settings> {
  const row = await db.getFirstAsync<SettingsRow>(
    `SELECT
       out_reminder_enabled,
       out_reminder_minutes,
       tray_change_reminder_enabled,
       tray_change_reminder_hour,
       tray_change_reminder_minute
     FROM settings
     WHERE id = 1`,
  );

  if (row === null) {
    throw new Error('Notification settings are missing.');
  }

  return mapSettings(row);
}

export async function updateNotificationSettings(db: SQLiteDatabase, settings: Settings) {
  const result = await db.runAsync(
    `UPDATE settings
     SET out_reminder_enabled = ?,
         out_reminder_minutes = ?,
         tray_change_reminder_enabled = ?,
         tray_change_reminder_hour = ?,
         tray_change_reminder_minute = ?
     WHERE id = 1`,
    settings.outReminderEnabled ? 1 : 0,
    settings.outReminderMinutes,
    settings.trayChangeReminderEnabled ? 1 : 0,
    settings.trayChangeReminderHour,
    settings.trayChangeReminderMinute,
  );

  if (result.changes !== 1) {
    throw new Error('Notification settings could not be saved.');
  }
}
