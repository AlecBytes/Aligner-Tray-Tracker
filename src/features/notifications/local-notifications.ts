import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import {
  buildReminderRequests,
  planReminderReconciliation,
  REMINDER_FINGERPRINT_DATA_KEY,
  REMINDER_KIND_DATA_KEY,
  type ScheduledReminder,
} from '@/features/notifications/notification-policy';
import { getTrackerSnapshot } from '@/features/tracker/tracker-repository';

const REMINDER_CHANNEL_ID = 'treatment-reminders';

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
    sound: 'default',
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

async function reconcile(db: SQLiteDatabase, notifications: NotificationsModule) {
  const now = Date.now();
  const snapshot = await getTrackerSnapshot(db, now);
  const scheduled = await notifications.getAllScheduledNotificationsAsync();
  const scheduledReminders: ScheduledReminder[] = scheduled.map((request) => ({
    fingerprint: request.content.data?.[REMINDER_FINGERPRINT_DATA_KEY],
    identifier: request.identifier,
    kind: request.content.data?.[REMINDER_KIND_DATA_KEY],
  }));
  const reconciliation = planReminderReconciliation(
    buildReminderRequests(snapshot, now),
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
        sound: 'default',
        title: 'Aligner Tracker',
      },
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
    const snapshot = await getTrackerSnapshot(db);

    if (snapshot !== null) {
      const notifications = await getNotificationsModule();

      if (await requestPermissionIfNeeded(notifications)) {
        await reconcile(db, notifications);
      }
    }
  });
}

export function reconcileLocalNotifications(db: SQLiteDatabase) {
  if (Platform.OS === 'web') {
    return Promise.resolve();
  }

  return enqueueNotificationWork(async () => {
    const notifications = await getNotificationsModule();
    await prepareAndroidChannel(notifications);
    const permissions = await notifications.getPermissionsAsync();

    if (notificationsAreAllowed(notifications, permissions)) {
      await reconcile(db, notifications);
    }
  });
}
