import { paidAccessConfig } from './paid-access-config';
import { createMockPaidAccessService } from './mock-paid-access-service';
import { createRevenueCatPaidAccessService } from './revenuecat-paid-access-service.ios';
import { unavailablePaidAccessService } from './unavailable-paid-access-service';
export const defaultPaidAccessService = paidAccessConfig.mode === 'mock' ? createMockPaidAccessService() : ((paidAccessConfig.mode === 'apple' || paidAccessConfig.mode === 'test-store') && paidAccessConfig.apiKey ? createRevenueCatPaidAccessService(paidAccessConfig.apiKey) : unavailablePaidAccessService);
