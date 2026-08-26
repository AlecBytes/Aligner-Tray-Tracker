const mockEnsureWearStatus = jest.fn();
const mockReconcileNotifications = jest.fn();
const mockAddListener = jest.fn();

jest.mock('../../../modules/aligner-tracker-intents', () => ({
  __esModule: true,
  default: {
    addListener: mockAddListener,
    ensureWearStatus: mockEnsureWearStatus,
    reconcileNotifications: mockReconcileNotifications,
  },
}));

// The mock must be declared before this platform-specific module is loaded.
// eslint-disable-next-line import/first
import {
  addWearStatusChangedListener,
  ensureWearStatus,
  isNativeWearStatusAvailable,
  reconcileNativeNotifications,
} from '@/features/siri/aligner-tracker-intents.ios';

describe('Aligner Tracker App Intents bridge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes the requested end state and invocation timestamp to native code', async () => {
    const result = {
      notificationStatus: 'reconciled',
      outcome: 'changed',
      punch: { id: 91, status: 'OUT', timestamp: 2_000 },
    };
    mockEnsureWearStatus.mockResolvedValue(result);

    await expect(ensureWearStatus('OUT', 2_000)).resolves.toBe(result);
    expect(mockEnsureWearStatus).toHaveBeenCalledWith('OUT', 2_000);
    expect(isNativeWearStatusAvailable()).toBe(true);
  });

  it('routes notification reconciliation and native change listeners', async () => {
    const subscription = { remove: jest.fn() };
    const listener = jest.fn();
    mockReconcileNotifications.mockResolvedValue(true);
    mockAddListener.mockReturnValue(subscription);

    await expect(reconcileNativeNotifications()).resolves.toBe(true);
    expect(addWearStatusChangedListener(listener)).toBe(subscription);
    expect(mockAddListener).toHaveBeenCalledWith('onWearStatusChanged', listener);
  });
});
