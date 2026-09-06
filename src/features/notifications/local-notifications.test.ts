import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { reconcileLocalNotifications } from '@/features/notifications/local-notifications';
import { updateNotificationSettings } from '@/features/notifications/notification-settings-repository';

const mockGetPermissionsAsync = jest.fn();
const mockGetAllScheduledNotificationsAsync = jest.fn();
const mockScheduleNotificationAsync = jest.fn();
const mockCancelScheduledNotificationAsync = jest.fn();
const mockRequestPermissionsAsync = jest.fn();
const mockGetTrackerSnapshot = jest.fn();

jest.mock('@/features/notifications/expo-notifications-module', () => ({
  loadExpoNotificationsModule: async () => jest.requireMock('expo-notifications'),
}));

jest.mock('@/features/tracker/tracker-repository', () => ({
  getTrackerSnapshot: (...args: unknown[]) => mockGetTrackerSnapshot(...args),
}));

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
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissionsAsync(...args),
  getAllScheduledNotificationsAsync: (...args: unknown[]) => mockGetAllScheduledNotificationsAsync(...args),
  scheduleNotificationAsync: (...args: unknown[]) => mockScheduleNotificationAsync(...args),
  cancelScheduledNotificationAsync: (...args: unknown[]) => mockCancelScheduledNotificationAsync(...args),
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissionsAsync(...args),
  setNotificationChannelAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
}));

describe('notification failure isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps saved preferences when the native notification API fails', async () => {
    const originalPlatform = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    const runAsync = jest.fn(async () => ({ changes: 1, lastInsertRowId: 0 }));
    const db = { runAsync } as unknown as SQLiteDatabase;
    const settings = {
      outReminderEnabled: true,
      outReminderMinutes: 60,
      outPersistentReminderIntervalMinutes: 5,
      trayChangeReminderEnabled: true,
      trayChangeOverdueReminderEnabled: true,
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
    expect(mockGetPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it.each([true, false])('reconciles the overdue series with permission granted = %s', async (granted) => {
    const originalPlatform = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    const now = Date.now();
    mockGetPermissionsAsync.mockResolvedValue({ granted, canAskAgain: false, status: granted ? 'granted' : 'denied' });
    mockGetAllScheduledNotificationsAsync.mockResolvedValue([{
      identifier: 'stale-overdue',
      content: { data: { alignerReminderKind: 'tray-change-overdue', alignerReminderFingerprint: 'stale' } },
    }, {
      identifier: 'unrelated', content: { data: { alignerReminderKind: 'other' } },
    }]);
    mockGetTrackerSnapshot.mockResolvedValue({
      trayPeriodId: 33, currentTrayNumber: 7, totalTrays: 20, daysPerTray: 7,
      trayStartedAt: now, punches: [{ id: 1, status: 'IN', timestamp: now }],
    });
    const getFirstAsync = jest.fn(async () => ({
      out_reminder_enabled: 0, out_reminder_minutes: 45,
      out_persistent_reminder_interval_minutes: 5, tray_change_reminder_enabled: 1,
      tray_change_reminder_hour: 9, tray_change_reminder_minute: 0,
      tray_change_overdue_reminder_enabled: 1,
    }));
    try {
      await reconcileLocalNotifications({ getFirstAsync } as unknown as SQLiteDatabase, { requestPermission: true });
      expect(mockCancelScheduledNotificationAsync.mock.calls).toEqual([['stale-overdue']]);
      expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
      expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(granted ? 15 : 0);
      if (granted) {
        const requests = mockScheduleNotificationAsync.mock.calls.map(([request]) => request);
        expect(new Set(requests.map((request) => request.identifier)).size).toBe(15);
        expect(requests.filter((request) => request.content.data.alignerReminderKind === 'tray-change-overdue')).toHaveLength(14);
        expect(requests.every((request) => request.content.sound === 'default' && request.trigger.channelId === 'treatment-reminders')).toBe(true);
      }
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    }
  });

  it('keeps notification reconciliation disabled on web', async () => {
    const originalPlatform = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });

    try {
      await expect(
        reconcileLocalNotifications({} as SQLiteDatabase),
      ).resolves.toBeUndefined();
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
    }

    expect(mockGetPermissionsAsync).not.toHaveBeenCalled();
  });
});
