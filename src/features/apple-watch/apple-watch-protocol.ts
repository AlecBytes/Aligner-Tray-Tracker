import type { WearStatus } from '@/db/schema';

export type WatchRequestV1 =
  | { version: 1; requestId: string; operation: 'getSnapshot' }
  | {
      version: 1;
      requestId: string;
      operation: 'setWearStatus';
      expectedStatus: WearStatus;
      desiredStatus: WearStatus;
    };

export type WatchTrackerSnapshotV1 =
  | {
      version: 1;
      kind: 'ready';
      currentTrayNumber: number;
      totalTrays: number;
      trayDay: number;
      status: WearStatus;
      inTodayMinutes: number;
      outTodayMinutes: number;
      generatedAtMs: number;
    }
  | { version: 1; kind: 'no-treatment'; generatedAtMs: number };

export type WatchResponseV1 = {
  version: 1;
  requestId: string;
  outcome: 'changed' | 'state-conflict' | 'no-treatment' | 'failed';
  snapshot?: WatchTrackerSnapshotV1;
  notificationWarning?: boolean;
};
