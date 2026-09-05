export type PaidAccessSnapshot = { hasPremiumAccess: boolean; isLifetime: boolean; expirationAt: number | null };
export type PaidAccessPackage = { id: string; kind: 'monthly' | 'annual' | 'lifetime'; displayPrice: string };
export type PurchaseOutcome = 'cancelled' | 'pending' | 'purchased';
export interface PaidAccessService {
  readonly available: boolean;
  getAccess(): Promise<PaidAccessSnapshot>;
  loadPackages(): Promise<readonly PaidAccessPackage[]>;
  purchase(packageId: string): Promise<{ access: PaidAccessSnapshot; outcome: PurchaseOutcome }>;
  restore(): Promise<PaidAccessSnapshot>;
  showManageSubscriptions(): Promise<void>;
  subscribe(listener: (access: PaidAccessSnapshot) => void): () => void;
}
export const NO_PAID_ACCESS: PaidAccessSnapshot = { hasPremiumAccess: false, isLifetime: false, expirationAt: null };
export function enforceKnownExpiration(access: PaidAccessSnapshot, now = Date.now()): PaidAccessSnapshot {
  return access.hasPremiumAccess && !access.isLifetime && access.expirationAt !== null && access.expirationAt <= now
    ? NO_PAID_ACCESS : access;
}
export function resolvePremiumAccess(input: { expirationAt: number | null; isActive: boolean; isLifetimeProduct: boolean }, now = Date.now()): PaidAccessSnapshot {
  if (!input.isActive) return NO_PAID_ACCESS;
  if (input.isLifetimeProduct) return { hasPremiumAccess: true, isLifetime: true, expirationAt: null };
  if (input.expirationAt === null) return NO_PAID_ACCESS;
  return enforceKnownExpiration({ hasPremiumAccess: true, isLifetime: false, expirationAt: input.expirationAt }, now);
}
