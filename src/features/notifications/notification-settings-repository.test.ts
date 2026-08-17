import type { SQLiteDatabase } from 'expo-sqlite';

import { DEFAULT_NOTIFICATION_SETTINGS } from '@/features/notifications/notification-settings-model';
import {
  getNotificationSettings,
  updateNotificationSettings,
} from '@/features/notifications/notification-settings-repository';

function createSettingsDatabase() {
  const row = {
    out_reminder_enabled: DEFAULT_NOTIFICATION_SETTINGS.outReminderEnabled ? 1 : 0,
    out_reminder_minutes: DEFAULT_NOTIFICATION_SETTINGS.outReminderMinutes,
    tray_change_reminder_enabled: DEFAULT_NOTIFICATION_SETTINGS.trayChangeReminderEnabled ? 1 : 0,
    tray_change_reminder_hour: DEFAULT_NOTIFICATION_SETTINGS.trayChangeReminderHour,
    tray_change_reminder_minute: DEFAULT_NOTIFICATION_SETTINGS.trayChangeReminderMinute,
  };
  const getFirstAsync = jest.fn(async () => ({ ...row }));
  const runAsync = jest.fn(async (_sql: string, ...parameters: number[]) => {
    [
      row.out_reminder_enabled,
      row.out_reminder_minutes,
      row.tray_change_reminder_enabled,
      row.tray_change_reminder_hour,
      row.tray_change_reminder_minute,
    ] = parameters;
    return { changes: 1, lastInsertRowId: 0 };
  });

  return {
    db: { getFirstAsync, runAsync } as unknown as SQLiteDatabase,
    getFirstAsync,
    runAsync,
  };
}

describe('notification settings persistence', () => {
  it('loads enabled 45-minute and 9:00 AM defaults', async () => {
    const database = createSettingsDatabase();

    await expect(getNotificationSettings(database.db)).resolves.toEqual(
      DEFAULT_NOTIFICATION_SETTINGS,
    );
  });

  it('persists both reminder switches, duration, and local time', async () => {
    const database = createSettingsDatabase();
    const settings = {
      outReminderEnabled: false,
      outReminderMinutes: 75,
      trayChangeReminderEnabled: true,
      trayChangeReminderHour: 18,
      trayChangeReminderMinute: 30,
    };

    await updateNotificationSettings(database.db, settings);

    expect(database.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE settings'),
      0,
      75,
      1,
      18,
      30,
    );
    await expect(getNotificationSettings(database.db)).resolves.toEqual(settings);
  });
});
