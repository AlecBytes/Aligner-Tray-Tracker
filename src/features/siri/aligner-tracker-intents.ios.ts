import type { WearStatus } from '@/db/schema';
import type {
  EnsureWearStatusResult,
  WearStatusChangedListener,
  WearStatusChangedSubscription,
} from '@/features/siri/aligner-tracker-intents.types';

type IntentsModule = typeof import('../../../modules/aligner-tracker-intents').default;

let intentsModule: IntentsModule | null | undefined;

function getIntentsModule(): IntentsModule | null {
  if (intentsModule !== undefined) {
    return intentsModule;
  }
  try {
    // The native module is absent in Expo Go and in JS-only test environments.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    intentsModule = require('../../../modules/aligner-tracker-intents').default;
  } catch {
    intentsModule = null;
  }
  return intentsModule ?? null;
}

export function isNativeWearStatusAvailable() {
  return getIntentsModule() !== null;
}

export function ensureWearStatus(
  status: WearStatus,
  timestamp = Date.now(),
): Promise<EnsureWearStatusResult> {
  const module = getIntentsModule();
  return module === null
    ? Promise.reject(new Error('Aligner Tracker App Intents are unavailable in this build.'))
    : module.ensureWearStatus(status, timestamp);
}

export async function reconcileNativeNotifications(): Promise<boolean> {
  return getIntentsModule()?.reconcileNotifications() ?? false;
}

export async function refreshWatchTrackerSnapshot(): Promise<boolean> {
  try {
    return (await getIntentsModule()?.refreshWatchTrackerSnapshot()) ?? false;
  } catch {
    return false;
  }
}

export function addWearStatusChangedListener(
  listener: WearStatusChangedListener,
): WearStatusChangedSubscription {
  return getIntentsModule()?.addListener('onWearStatusChanged', listener) ?? { remove() {} };
}
