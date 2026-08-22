import { supportMode, type SupportMode } from '@/config/support-config';
import { mockSupportPurchaseService } from '@/features/support/mock-support-purchase-service';
import type { SupportPurchaseService } from '@/features/support/support-purchase-service';

const unavailableSupportPurchaseService: SupportPurchaseService = {
  async loadProducts() {
    return [];
  },
  async purchase() {
    throw new Error('Support purchases are not configured.');
  },
};

export function getSupportPurchaseService(mode: SupportMode): SupportPurchaseService {
  return mode === 'mock' ? mockSupportPurchaseService : unavailableSupportPurchaseService;
}

export const defaultSupportPurchaseService = getSupportPurchaseService(supportMode);
