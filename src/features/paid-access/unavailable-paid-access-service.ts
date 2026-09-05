import { NO_PAID_ACCESS, type PaidAccessService } from '@/features/paid-access/paid-access-service';
export const unavailablePaidAccessService: PaidAccessService = {
  available: false,
  async getAccess() { return NO_PAID_ACCESS; },
  async loadPackages() { return []; },
  async purchase() { throw new Error('Paid access is unavailable.'); },
  async restore() { return NO_PAID_ACCESS; },
  async showManageSubscriptions() { throw new Error('Subscription management is unavailable.'); },
  subscribe() { return () => undefined; },
};
