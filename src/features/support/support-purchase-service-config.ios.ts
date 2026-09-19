import { supportConfig, type SupportConfig } from '@/config/support-config';
import { mockSupportPurchaseService } from '@/features/support/mock-support-purchase-service';
import { createRevenueCatSupportPurchaseService } from '@/features/support/revenuecat-support-purchase-service.ios';
import type { SupportPurchaseService } from '@/features/support/support-purchase-service';

export const unavailableSupportPurchaseService: SupportPurchaseService = {
  async loadProducts() {
    return [];
  },
  async purchase() {
    throw new Error('Support purchases are not configured.');
  },
};

export function getSupportPurchaseService(config: SupportConfig): SupportPurchaseService {
  if (config.mode === 'mock') {
    return mockSupportPurchaseService;
  }

  if (config.mode === 'apple' && config.apiKey) {
    return createRevenueCatSupportPurchaseService(config.apiKey);
  }

  return unavailableSupportPurchaseService;
}

export const defaultSupportPurchaseService = getSupportPurchaseService(supportConfig);
