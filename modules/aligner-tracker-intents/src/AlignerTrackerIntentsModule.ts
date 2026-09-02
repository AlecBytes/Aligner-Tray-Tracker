import { NativeModule, requireNativeModule } from 'expo';

import type {
  EnsureWearStatusResult,
  WearStatus,
  WearStatusChangedEvent,
} from './AlignerTrackerIntents.types';

type AlignerTrackerIntentsEvents = {
  onWearStatusChanged: (event: WearStatusChangedEvent) => void;
};

declare class AlignerTrackerIntentsModule extends NativeModule<AlignerTrackerIntentsEvents> {
  ensureWearStatus(status: WearStatus, timestamp: number): Promise<EnsureWearStatusResult>;
  reconcileNotifications(): Promise<boolean>;
  refreshWatchTrackerSnapshot(): Promise<boolean>;
}

export default requireNativeModule<AlignerTrackerIntentsModule>('AlignerTrackerIntents');
