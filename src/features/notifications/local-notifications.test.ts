import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { reconcileLocalNotifications } from '@/features/notifications/local-notifications';
import { updateNotificationSettings } from '@/features/notifications/notification-settings-repository';

const mockGetPermissionsAsync = jest.fn();

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  IosAuthorizationStatus: {
    AUTHORIZED: 2,
    EPHEMERAL: 4,
    NOT_DETERMINED: 0,
    PROVISIONAL: 3,
  },
  PermissionStatus: { UNDETERMINED: 'undetermined' },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  getPermissionsAsync: mockGetPermissionsAsync,
  setNotificationHandler: jest.fn(),
}));

describe('notification failure isolation', () => {
  it('keeps saved preferences when the native notification API fails', async () => {
    const originalPlatform = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    const runAsync = jest.fn(async () => ({ changes: 1, lastInsertRowId: 0 }));
    const db = { runAsync } as unknown as SQLiteDatabase;
    const settings = {
      outReminderEnabled: true,
      outReminderMinutes: 60,
      outPersistentReminderIntervalMinutes: 5,
      trayChangeReminderEnabled: false,
      trayChangeReminderHour: 9,
      trayChangeReminderMinute: 0,
    };
    mockGetPermissionsAsync.mockRejectedValueOnce(new Error('native API unavailable'));

    try {
      await updateNotificationSettings(db, settings);
      await expect(reconcileLocalNotifications(db)).resolves.toBeUndefined();
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    }

    expect(runAsync).toHaveBeenCalledTimes(1);
  });
});
