import {
  DEFAULT_NOTIFICATION_SETTINGS,
  formatReminderTime,
  parseReminderTime,
  validateNotificationSettings,
} from '@/features/notifications/notification-settings-model';

describe('notification settings model', () => {
  it('uses enabled 45-minute, 5-minute persistent, and 9:00 AM defaults', () => {
    expect(DEFAULT_NOTIFICATION_SETTINGS).toEqual({
      outReminderEnabled: true,
      outReminderMinutes: 45,
      outPersistentReminderIntervalMinutes: 5,
      trayChangeReminderEnabled: true,
      trayChangeReminderHour: 9,
      trayChangeReminderMinute: 0,
    });
  });

  it('parses and formats local reminder times', () => {
    expect(parseReminderTime('12:05 AM')).toEqual({ hour: 0, minute: 5 });
    expect(parseReminderTime('6:30 pm')).toEqual({ hour: 18, minute: 30 });
    expect(formatReminderTime(18, 30)).toBe('6:30 PM');
  });

  it('enforces the supported duration and time formats', () => {
    expect(
      validateNotificationSettings({
        outReminderMinutes: '4',
        outPersistentReminderIntervalMinutes: '241',
        trayChangeReminderTime: '25:00',
      }),
    ).toEqual({
      errors: {
        outReminderMinutes: 'Enter a whole number from 5 to 240.',
        outPersistentReminderIntervalMinutes:
          'Enter a whole number from 5 to 240.',
        trayChangeReminderTime: 'Enter a time such as 9:00 AM.',
      },
      success: false,
    });
  });
});
