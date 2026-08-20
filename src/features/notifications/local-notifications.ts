import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import {
  buildReminderRequests,
  planReminderReconciliation,
  REMINDER_FINGERPRINT_DATA_KEY,
  REMINDER_KIND_DATA_KEY,
  REMINDER_SOUND,
  type ScheduledReminder,
} from '@/features/notifications/notification-policy';
import { getNotificationSettings } from '@/features/notifications/notification-settings-repository';
import { getTrackerSnapshot } from '@/features/tracker/tracker-repository';

const REMINDER_CHANNEL_ID = 'treatment-reminders';

const REMINDER_IDENTIFIERS = {
  'out-too-long': 'aligner-tracker-out-too-long',
  'tray-change': 'aligner-tracker-tray-change',
} as const;

export type LocalNotificationPermissionState =
  | 'denied'
  | 'granted'
  | 'unavailable'
  | 'undetermined';

type NotificationsModule = typeof import('expo-notifications');

let notificationWork = Promise.resolve();
let notificationsModule: Promise<NotificationsModule> | null = null;

async function getNotificationsModule() {
  notificationsModule ??= import('expo-notifications').then((notifications) => {
    try {
      notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    } catch {
      // Scheduling can still degrade safely if foreground presentation is unavailable.
    }

    return notifications;
  });

  return notificationsModule;
}

function enqueueNotificationWork(task: () => Promise<void>) {
  const nextWork = notificationWork.then(task, task);
  notificationWork = nextWork.catch(() => undefined);
  return notificationWork;
}

function notificationsAreAllowed(
  notifications: NotificationsModule,
  permissions: import('expo-notifications').NotificationPermissionsStatus,
) {
  const iosStatus = permissions.ios?.status;

  return (
    permissions.granted ||
    iosStatus === notifications.IosAuthorizationStatus.AUTHORIZED ||
    iosStatus === notifications.IosAuthorizationStatus.PROVISIONAL ||
    iosStatus === notifications.IosAuthorizationStatus.EPHEMERAL
  );
}

async function prepareAndroidChannel(notifications: NotificationsModule) {
  if (Platform.OS !== 'android') {
    return;
  }

  await notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    importance: notifications.AndroidImportance.DEFAULT,
    name: 'Treatment reminders',
    sound: REMINDER_SOUND,
  });
}

async function requestPermissionIfNeeded(notifications: NotificationsModule) {
  await prepareAndroidChannel(notifications);

  let permissions = await notifications.getPermissionsAsync();

  if (
    !notificationsAreAllowed(notifications, permissions) &&
    permissions.canAskAgain &&
    (permissions.status === notifications.PermissionStatus.UNDETERMINED ||
      permissions.ios?.status ===
        notifications.IosAuthorizationStatus.NOT_DETERMINED)
  ) {
    permissions = await notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowSound: true,
      },
    });
  }

  return notificationsAreAllowed(notifications, permissions);
}

function permissionState(
  notifications: NotificationsModule,
  permissions: import('expo-notifications').NotificationPermissionsStatus,
): LocalNotificationPermissionState {
  if (notificationsAreAllowed(notifications, permissions)) {
    return 'granted';
  }

  if (
    permissions.status === notifications.PermissionStatus.UNDETERMINED ||
    permissions.ios?.status === notifications.IosAuthorizationStatus.NOT_DETERMINED
  ) {
    return 'undetermined';
  }

  return 'denied';
}

async function reconcile(
  db: SQLiteDatabase,
  notifications: NotificationsModule,
  canSchedule: boolean,
) {
  const now = Date.now();
  const [snapshot, settings] = await Promise.all([
    getTrackerSnapshot(db, now),
    getNotificationSettings(db),
  ]);
  const scheduled = await notifications.getAllScheduledNotificationsAsync();
  const scheduledReminders: ScheduledReminder[] = scheduled.map((request) => ({
    fingerprint: request.content.data?.[REMINDER_FINGERPRINT_DATA_KEY],
    identifier: request.identifier,
    kind: request.content.data?.[REMINDER_KIND_DATA_KEY],
  }));
  const reconciliation = planReminderReconciliation(
    canSchedule ? buildReminderRequests(snapshot, settings, now) : [],
    scheduledReminders,
  );

  await Promise.all(
    reconciliation.cancelIdentifiers.map((identifier) =>
      notifications.cancelScheduledNotificationAsync(identifier),
    ),
  );

  for (const reminder of reconciliation.schedule) {
    await notifications.scheduleNotificationAsync({
      content: {
        body: reminder.body,
        data: {
          [REMINDER_FINGERPRINT_DATA_KEY]: reminder.fingerprint,
          [REMINDER_KIND_DATA_KEY]: reminder.kind,
        },
        sound: reminder.sound,
        title: 'Aligner Tracker',
      },
      identifier: REMINDER_IDENTIFIERS[reminder.kind],
      trigger: {
        channelId: Platform.OS === 'android' ? REMINDER_CHANNEL_ID : undefined,
        date: reminder.scheduledAt,
        type: notifications.SchedulableTriggerInputTypes.DATE,
      },
    });
  }
}

export function initializeLocalNotifications(db: SQLiteDatabase) {
  if (Platform.OS === 'web') {
    return Promise.resolve();
  }

  return enqueueNotificationWork(async () => {
    const settings = await getNotificationSettings(db);
    const notifications = await getNotificationsModule();
    const hasEnabledReminder =
      settings.outReminderEnabled || settings.trayChangeReminderEnabled;
    const allowed = hasEnabledReminder
      ? await requestPermissionIfNeeded(notifications)
      : notificationsAreAllowed(notifications, await notifications.getPermissionsAsync());

    await reconcile(db, notifications, allowed);
  });
}

export function reconcileLocalNotifications(
  db: SQLiteDatabase,
  options: { requestPermission?: boolean } = {},
) {
  if (Platform.OS === 'web') {
    return Promise.resolve();
  }

  return enqueueNotificationWork(async () => {
    const notifications = await getNotificationsModule();
    await prepareAndroidChannel(notifications);
    const allowed = options.requestPermission
      ? await requestPermissionIfNeeded(notifications)
      : notificationsAreAllowed(notifications, await notifications.getPermissionsAsync());

    await reconcile(db, notifications, allowed);
  });
}

export async function getLocalNotificationPermissionState(): Promise<LocalNotificationPermissionState> {
  if (Platform.OS === 'web') {
    return 'unavailable';
  }

  try {
    const notifications = await getNotificationsModule();
    const permissions = await notifications.getPermissionsAsync();
    return permissionState(notifications, permissions);
  } catch {
    return 'unavailable';
  }
}
