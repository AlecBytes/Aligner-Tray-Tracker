import type { Settings } from '@/db/schema';

export const DEFAULT_NOTIFICATION_SETTINGS: Settings = {
  outReminderEnabled: true,
  outReminderMinutes: 45,
  trayChangeReminderEnabled: true,
  trayChangeReminderHour: 9,
  trayChangeReminderMinute: 0,
};

export const MIN_OUT_REMINDER_MINUTES = 5;
export const MAX_OUT_REMINDER_MINUTES = 240;

export type NotificationSettingsFormValues = {
  outReminderMinutes: string;
  trayChangeReminderTime: string;
};

export type NotificationSettingsValidationErrors = Partial<
  Record<keyof NotificationSettingsFormValues, string>
>;

export type NotificationSettingsValidationResult =
  | { errors: NotificationSettingsValidationErrors; success: false }
  | {
      data: Pick<
        Settings,
        'outReminderMinutes' | 'trayChangeReminderHour' | 'trayChangeReminderMinute'
      >;
      success: true;
    };

export function formatReminderTime(hour: number, minute: number) {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
}

export function parseReminderTime(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);

  if (match === null) {
    return null;
  }

  const displayHour = Number(match[1]);
  const minute = Number(match[2]);

  if (displayHour < 1 || displayHour > 12 || minute < 0 || minute > 59) {
    return null;
  }

  const period = match[3].toUpperCase();
  const hour = (displayHour % 12) + (period === 'PM' ? 12 : 0);
  return { hour, minute };
}

export function validateNotificationSettings(
  values: NotificationSettingsFormValues,
): NotificationSettingsValidationResult {
  const errors: NotificationSettingsValidationErrors = {};
  const normalizedMinutes = values.outReminderMinutes.trim();
  const outReminderMinutes = /^\d+$/.test(normalizedMinutes)
    ? Number(normalizedMinutes)
    : Number.NaN;
  const reminderTime = parseReminderTime(values.trayChangeReminderTime);

  if (
    !Number.isSafeInteger(outReminderMinutes) ||
    outReminderMinutes < MIN_OUT_REMINDER_MINUTES ||
    outReminderMinutes > MAX_OUT_REMINDER_MINUTES
  ) {
    errors.outReminderMinutes = `Enter a whole number from ${MIN_OUT_REMINDER_MINUTES} to ${MAX_OUT_REMINDER_MINUTES}.`;
  }

  if (reminderTime === null) {
    errors.trayChangeReminderTime = 'Enter a time such as 9:00 AM.';
  }

  if (Object.keys(errors).length > 0 || reminderTime === null) {
    return { errors, success: false };
  }

  return {
    data: {
      outReminderMinutes,
      trayChangeReminderHour: reminderTime.hour,
      trayChangeReminderMinute: reminderTime.minute,
    },
    success: true,
  };
}
