import { NO_PAID_ACCESS, type PaidAccessPackage, type PaidAccessService, type PaidAccessSnapshot, type PurchaseOutcome } from './paid-access-service';
export const MOCK_PAID_ACCESS_PACKAGES: readonly PaidAccessPackage[] = [
  { id: 'mock-monthly', kind: 'monthly', displayPrice: '$0.99' }, { id: 'mock-annual', kind: 'annual', displayPrice: '$7.99' }, { id: 'mock-lifetime', kind: 'lifetime', displayPrice: '$49.99' },
];
export function createMockPaidAccessService(initial: PaidAccessSnapshot = NO_PAID_ACCESS, outcome: PurchaseOutcome = 'purchased'): PaidAccessService {
  let access = initial; const listeners = new Set<(value: PaidAccessSnapshot) => void>();
  return { available: true, async getAccess() { return access; }, async loadPackages() { return MOCK_PAID_ACCESS_PACKAGES; },
    async purchase(id) { if (outcome === 'purchased') { access = { hasPremiumAccess: true, isLifetime: id === 'mock-lifetime', expirationAt: id === 'mock-lifetime' ? null : Date.now() + 86400000 }; listeners.forEach((x) => x(access)); } return { access, outcome }; },
    async restore() { return access; }, async showManageSubscriptions() {}, subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); } };
}
