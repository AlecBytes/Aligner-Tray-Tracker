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
      predecessor: WearPunch;
      punch: WearPunch;
      trayPeriodId: number;
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

export type CommitWearStatusResult = { nativeCommitDurationMs: number } & (
  | Omit<Extract<EnsureWearStatusResult, { outcome: 'changed' }>, 'notificationStatus'>
  | Omit<Extract<EnsureWearStatusResult, { outcome: 'already-in-state' }>, 'notificationStatus'>
  | Omit<Extract<EnsureWearStatusResult, { outcome: 'no-active-treatment' }>, 'notificationStatus'>
);

export type WearStatusChangedEvent = {
  status: WearStatus;
  timestamp: number;
};
