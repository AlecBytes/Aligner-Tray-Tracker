import type { Settings } from '@/db/schema';
import type { TrackerSnapshot } from '@/features/tracker/tracker-model';

const MILLISECONDS_PER_MINUTE = 60 * 1000;

export const REMINDER_KIND_DATA_KEY = 'alignerReminderKind';
export const REMINDER_FINGERPRINT_DATA_KEY = 'alignerReminderFingerprint';
export const REMINDER_SOUND = 'default' as const;

export type ReminderKind = 'out-too-long' | 'tray-change';

export type ReminderRequest = {
  body: string;
  fingerprint: string;
  kind: ReminderKind;
  scheduledAt: number;
  sound: typeof REMINDER_SOUND;
};

export type ScheduledReminder = {
  fingerprint: unknown;
  identifier: string;
  kind: unknown;
};

export type ReminderReconciliation = {
  cancelIdentifiers: string[];
  schedule: ReminderRequest[];
};

function addLocalCalendarDays(timestamp: number, days: number) {
  const date = new Date(timestamp);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

function setLocalTime(timestamp: number, hour: number, minute: number) {
  const date = new Date(timestamp);
  date.setHours(hour, minute, 0, 0);
  return date.getTime();
}

function reminderFingerprint(kind: ReminderKind, scheduledAt: number, subject: number) {
  return `${kind}:${scheduledAt}:${subject}`;
}

export function buildReminderRequests(
  snapshot: TrackerSnapshot | null,
  settings: Settings,
  now = Date.now(),
): ReminderRequest[] {
  if (snapshot === null) {
    return [];
  }

  const reminders: ReminderRequest[] = [];
  const trayChangeDueDate = addLocalCalendarDays(
    snapshot.trayStartedAt,
    snapshot.daysPerTray,
  );
  const trayChangeAt = setLocalTime(
    trayChangeDueDate,
    settings.trayChangeReminderHour,
    settings.trayChangeReminderMinute,
  );
  const nextTrayNumber = snapshot.currentTrayNumber + 1;

  if (
    settings.trayChangeReminderEnabled &&
    nextTrayNumber <= snapshot.totalTrays &&
    trayChangeAt > now
  ) {
    reminders.push({
      body: `You are scheduled to change to Tray ${nextTrayNumber} today.`,
      fingerprint: reminderFingerprint(
        'tray-change',
        trayChangeAt,
        nextTrayNumber,
      ),
      kind: 'tray-change',
      scheduledAt: trayChangeAt,
      sound: REMINDER_SOUND,
    });
  }

  const latestPunch = snapshot.punches.reduce(
    (latest, punch) =>
      latest === null ||
      punch.timestamp > latest.timestamp ||
      (punch.timestamp === latest.timestamp && punch.id > latest.id)
        ? punch
        : latest,
    snapshot.punches[0] ?? null,
  );

  if (settings.outReminderEnabled && latestPunch?.status === 'OUT') {
    const outReminderAt =
      latestPunch.timestamp + settings.outReminderMinutes * MILLISECONDS_PER_MINUTE;

    if (outReminderAt > now) {
      reminders.push({
        body: `Your trays have been out for ${settings.outReminderMinutes} minutes.`,
        fingerprint: reminderFingerprint(
          'out-too-long',
          outReminderAt,
          snapshot.trayPeriodId,
        ),
        kind: 'out-too-long',
        scheduledAt: outReminderAt,
        sound: REMINDER_SOUND,
      });
    }
  }

  return reminders;
}

function isReminderKind(value: unknown): value is ReminderKind {
  return value === 'out-too-long' || value === 'tray-change';
}

export function planReminderReconciliation(
  desiredReminders: readonly ReminderRequest[],
  scheduledReminders: readonly ScheduledReminder[],
): ReminderReconciliation {
  const desiredByKind = new Map(
    desiredReminders.map((reminder) => [reminder.kind, reminder]),
  );
  const keptKinds = new Set<ReminderKind>();
  const cancelIdentifiers: string[] = [];

  for (const scheduled of scheduledReminders) {
    if (!isReminderKind(scheduled.kind)) {
      continue;
    }

    const desired = desiredByKind.get(scheduled.kind);

    if (
      desired !== undefined &&
      scheduled.fingerprint === desired.fingerprint &&
      !keptKinds.has(scheduled.kind)
    ) {
      keptKinds.add(scheduled.kind);
    } else {
      cancelIdentifiers.push(scheduled.identifier);
    }
  }

  return {
    cancelIdentifiers,
    schedule: desiredReminders.filter((reminder) => !keptKinds.has(reminder.kind)),
  };
}
