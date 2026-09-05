import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { usePaidAccess } from '@/features/paid-access/paid-access-provider';
import { resolveEffectiveThemeKey } from '@/theme/theme-access';
import { getSelectedThemeKey, updateSelectedThemeKey } from '@/theme/theme-preference-repository';
import { AppThemeContext } from '@/theme/use-app-theme';
import type { ThemeKey } from '@/theme/tokens';

export function AppThemeProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext(); const { access } = usePaidAccess(); const [savedThemeKey, setSavedThemeKey] = useState<ThemeKey>('default'); const savedRef = useRef<ThemeKey>('default'); const revision = useRef(0); const queue = useRef(Promise.resolve());
  const applyLocal = useCallback((key: ThemeKey) => { savedRef.current = key; setSavedThemeKey(key); }, []);
  const reloadTheme = useCallback(async () => { try { applyLocal(await getSelectedThemeKey(db)); } catch { applyLocal('default'); } }, [applyLocal, db]);
  useEffect(() => { void getSelectedThemeKey(db).then(applyLocal).catch(() => applyLocal('default')); }, [applyLocal, db]);
  const selectTheme = useCallback(async (key: ThemeKey) => { const previous = savedRef.current; const operationRevision = ++revision.current; applyLocal(key); const operation = queue.current.then(() => updateSelectedThemeKey(db, key)); queue.current = operation.catch(() => undefined); try { await operation; } catch (error) { if (revision.current === operationRevision) applyLocal(previous); throw error; } }, [applyLocal, db]);
  const value = useMemo(() => ({ savedThemeKey, effectiveThemeKey: resolveEffectiveThemeKey(savedThemeKey, access.hasPremiumAccess), selectTheme, reloadTheme }), [access.hasPremiumAccess, reloadTheme, savedThemeKey, selectTheme]);
  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}
