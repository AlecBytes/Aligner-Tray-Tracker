import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { defaultPaidAccessService } from './default-paid-access-service';
import { enforceKnownExpiration, NO_PAID_ACCESS, type PaidAccessPackage, type PaidAccessService, type PaidAccessSnapshot, type PurchaseOutcome } from './paid-access-service';

type PaidAccessContextValue = { access: PaidAccessSnapshot; available: boolean; packages: readonly PaidAccessPackage[]; loadPackages: () => Promise<void>; purchase: (id: string) => Promise<PurchaseOutcome>; restore: () => Promise<boolean>; manage: () => Promise<void>; packagesUnavailable: boolean };
const PaidAccessContext = createContext<PaidAccessContextValue>({ access: NO_PAID_ACCESS, available: false, packages: [], loadPackages: async () => undefined, purchase: async () => 'cancelled', restore: async () => false, manage: async () => undefined, packagesUnavailable: true });

export function PaidAccessProvider({ children, service = defaultPaidAccessService }: PropsWithChildren<{ service?: PaidAccessService }>) {
  const [access, setAccess] = useState(NO_PAID_ACCESS); const [packages, setPackages] = useState<readonly PaidAccessPackage[]>([]); const [packagesUnavailable, setUnavailable] = useState(!service.available); const refreshRef = useRef<Promise<void> | null>(null);
  const refresh = useCallback(() => { if (!service.available) return Promise.resolve(); if (!refreshRef.current) refreshRef.current = service.getAccess().then((value) => setAccess(enforceKnownExpiration(value))).catch(() => undefined).finally(() => { refreshRef.current = null; }); return refreshRef.current; }, [service]);
  useEffect(() => { void refresh(); const unsubscribe = service.subscribe((value) => setAccess(enforceKnownExpiration(value))); const appState = AppState.addEventListener('change', (state) => { if (state === 'active') void refresh(); }); return () => { unsubscribe(); appState.remove(); }; }, [refresh, service]);
  useEffect(() => { if (!access.hasPremiumAccess || access.isLifetime || access.expirationAt === null) return; const delay = Math.max(0, access.expirationAt - Date.now()); const timeout = setTimeout(() => setAccess((value) => enforceKnownExpiration(value)), delay); return () => clearTimeout(timeout); }, [access]);
  const loadPackages = useCallback(async () => { try { const value = await service.loadPackages(); setPackages(value); setUnavailable(value.length === 0); await refresh(); } catch { setPackages([]); setUnavailable(true); } }, [refresh, service]);
  const purchase = useCallback(async (id: string) => { const result = await service.purchase(id); setAccess(enforceKnownExpiration(result.access)); return result.outcome; }, [service]);
  const restore = useCallback(async () => { const result = enforceKnownExpiration(await service.restore()); setAccess(result); return result.hasPremiumAccess; }, [service]);
  return <PaidAccessContext.Provider value={{ access, available: service.available, packages, loadPackages, purchase, restore, manage: service.showManageSubscriptions.bind(service), packagesUnavailable }}>{children}</PaidAccessContext.Provider>;
}
export function usePaidAccess() { return useContext(PaidAccessContext); }
