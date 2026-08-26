import type { WearStatus } from '@/db/schema';
import type { WearPunchEvent } from '@/features/tracker/tracker-model';

export type EnsureWearStatusResult =
  | {
      notificationStatus: 'failed' | 'reconciled';
      outcome: 'changed';
      punch: WearPunchEvent;
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

export type WearStatusChangedListener = (
  event: WearStatusChangedEvent,
) => void;

export type WearStatusChangedSubscription = {
  remove: () => void;
};
