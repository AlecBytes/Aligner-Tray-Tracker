import Purchases, { PURCHASES_ERROR_CODE, type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';
import type { PaidAccessPackage, PaidAccessService, PaidAccessSnapshot } from './paid-access-service';
import { NO_PAID_ACCESS, resolvePremiumAccess } from './paid-access-service';

const packageCache = new Map<string, PurchasesPackage>();
function accessFrom(info: CustomerInfo): PaidAccessSnapshot {
  const entitlement = info.entitlements.active.aligner_tray_tracker_pro;
  if (!entitlement?.isActive) return NO_PAID_ACCESS;
  return resolvePremiumAccess({ isActive: entitlement.isActive, expirationAt: entitlement.expirationDateMillis, isLifetimeProduct: entitlement.expirationDateMillis === null && !info.activeSubscriptions.includes(entitlement.productIdentifier) });
}
function packageKind(value: string): PaidAccessPackage['kind'] | null {
  if (value === 'MONTHLY') return 'monthly'; if (value === 'ANNUAL') return 'annual'; if (value === 'LIFETIME') return 'lifetime'; return null;
}
export function createRevenueCatPaidAccessService(apiKey: string): PaidAccessService {
  let configured = false; let lastAccess = NO_PAID_ACCESS;
  function configure() { if (!configured) { Purchases.configure({ apiKey }); configured = true; } }
  function remember(info: CustomerInfo) { lastAccess = accessFrom(info); return lastAccess; }
  return { available: true,
    async getAccess() { configure(); return remember(await Purchases.getCustomerInfo()); },
    async loadPackages() { configure(); const offering = (await Purchases.getOfferings()).all.premium; packageCache.clear(); const order = { monthly: 0, annual: 1, lifetime: 2 } as const; const packages = (offering?.availablePackages ?? []).flatMap((item) => { const kind = packageKind(item.packageType); if (!kind) return []; packageCache.set(item.identifier, item); return [{ id: item.identifier, kind, displayPrice: item.product.priceString }]; }).sort((left, right) => order[left.kind] - order[right.kind]); return new Set(packages.map((item) => item.kind)).size === 3 ? packages : []; },
    async purchase(id) { configure(); const item = packageCache.get(id); if (!item) throw new Error('Purchase package is unavailable.'); try { const result = await Purchases.purchasePackage(item); const access = remember(result.customerInfo); return { access, outcome: access.hasPremiumAccess ? 'purchased' as const : 'pending' as const }; } catch (error) { const code = (error as { code?: string }).code; if (code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return { access: lastAccess, outcome: 'cancelled' }; if (code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) return { access: lastAccess, outcome: 'pending' }; throw error; } },
    async restore() { configure(); return remember(await Purchases.restorePurchases()); },
    async showManageSubscriptions() { configure(); await Purchases.showManageSubscriptions(); },
    subscribe(listener) { configure(); const callback = (info: CustomerInfo) => listener(remember(info)); Purchases.addCustomerInfoUpdateListener(callback); return () => { Purchases.removeCustomerInfoUpdateListener(callback); }; },
  };
}
