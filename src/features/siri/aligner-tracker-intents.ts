import type { WearStatus } from '@/db/schema';
import type {
  EnsureWearStatusResult,
  WearStatusChangedListener,
  WearStatusChangedSubscription,
} from '@/features/siri/aligner-tracker-intents.types';

export function isNativeWearStatusAvailable() {
  return false;
}

export function ensureWearStatus(
  _status: WearStatus,
  _timestamp = Date.now(),
): Promise<EnsureWearStatusResult> {
  return Promise.reject(new Error('App Intents are available only on iOS.'));
}

export function reconcileNativeNotifications(): Promise<boolean> {
  return Promise.resolve(false);
}

export function refreshWatchTrackerSnapshot(): Promise<boolean> {
  return Promise.resolve(false);
}

export function addWearStatusChangedListener(
  _listener: WearStatusChangedListener,
): WearStatusChangedSubscription {
  return { remove() {} };
}
