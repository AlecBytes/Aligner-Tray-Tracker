import type { WearStatus } from '@/db/schema';
import type { WearPunchEvent } from '@/features/tracker/tracker-model';

export type EnsureWearStatusResult =
  | {
      notificationStatus: 'failed' | 'reconciled';
      outcome: 'changed';
      predecessor: WearPunchEvent;
      punch: WearPunchEvent;
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

export type WearStatusChangedListener = (
  event: WearStatusChangedEvent,
) => void;

export type WearStatusChangedSubscription = {
  remove: () => void;
};
