const mockEnsureWearStatus = jest.fn();
const mockCommitWearStatus = jest.fn();
const mockReconcileNotifications = jest.fn();
const mockRefreshWatchTrackerSnapshot = jest.fn();
const mockAddListener = jest.fn();

jest.mock('../../../modules/aligner-tracker-intents', () => ({
  __esModule: true,
  default: {
    addListener: mockAddListener,
    commitWearStatus: mockCommitWearStatus,
    ensureWearStatus: mockEnsureWearStatus,
    reconcileNotifications: mockReconcileNotifications,
    refreshWatchTrackerSnapshot: mockRefreshWatchTrackerSnapshot,
  },
}));

// The mock must be declared before this platform-specific module is loaded.
// eslint-disable-next-line import/first
import {
  addWearStatusChangedListener,
  commitWearStatus,
  ensureWearStatus,
  isNativeWearStatusAvailable,
  reconcileNativeNotifications,
  refreshWatchTrackerSnapshot,
} from '@/features/siri/aligner-tracker-intents.ios';

describe('Aligner Tracker App Intents bridge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes the requested end state and invocation timestamp to native code', async () => {
    const result = {
      notificationStatus: 'reconciled',
      outcome: 'changed',
      predecessor: { id: 90, status: 'IN', timestamp: 1_000 },
      punch: { id: 91, status: 'OUT', timestamp: 2_000 },
      trayPeriodId: 7,
    };
    mockEnsureWearStatus.mockResolvedValue(result);

    await expect(ensureWearStatus('OUT', 2_000)).resolves.toBe(result);
    expect(mockEnsureWearStatus).toHaveBeenCalledWith('OUT', 2_000);
    expect(isNativeWearStatusAvailable()).toBe(true);
  });

  it('returns a foreground commit without starting notification reconciliation', async () => {
    const result = {
      nativeCommitDurationMs: 3,
      outcome: 'changed' as const,
      predecessor: { id: 90, status: 'IN' as const, timestamp: 1_000 },
      punch: { id: 91, status: 'OUT' as const, timestamp: 2_000 },
      trayPeriodId: 7,
    };
    mockCommitWearStatus.mockResolvedValue(result);

    await expect(commitWearStatus('OUT', 2_000)).resolves.toBe(result);
    expect(mockCommitWearStatus).toHaveBeenCalledWith('OUT', 2_000);
    expect(mockReconcileNotifications).not.toHaveBeenCalled();
  });

  it('routes notification reconciliation and native change listeners', async () => {
    const subscription = { remove: jest.fn() };
    const listener = jest.fn();
    mockReconcileNotifications.mockResolvedValue(true);
    mockRefreshWatchTrackerSnapshot.mockResolvedValue(true);
    mockAddListener.mockReturnValue(subscription);

    await expect(reconcileNativeNotifications()).resolves.toBe(true);
    await expect(refreshWatchTrackerSnapshot()).resolves.toBe(true);
    expect(addWearStatusChangedListener(listener)).toBe(subscription);
    expect(mockAddListener).toHaveBeenCalledWith('onWearStatusChanged', listener);
  });

  it('treats Watch refresh failures as best-effort', async () => {
    mockRefreshWatchTrackerSnapshot.mockRejectedValue(new Error('Watch is unavailable'));

    await expect(refreshWatchTrackerSnapshot()).resolves.toBe(false);
  });
});
