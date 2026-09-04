export type WearStatus = 'IN' | 'OUT';

export type WearPunch = {
  id: number;
  status: WearStatus;
  timestamp: number;
};

export type NotificationReconciliationStatus = 'failed' | 'not-needed' | 'reconciled';

export type EnsureWearStatusResult =
  | {
      notificationStatus: Exclude<NotificationReconciliationStatus, 'not-needed'>;
      outcome: 'changed';
      punch: WearPunch;
    }
  | {
      notificationStatus: 'not-needed';
      outcome: 'already-in-state';
      status: WearStatus;
    }
  | {
      notificationStatus: 'not-needed';
      outcome: 'no-active-treatment';
    };

export type WearStatusChangedEvent = {
  status: WearStatus;
  timestamp: number;
};
