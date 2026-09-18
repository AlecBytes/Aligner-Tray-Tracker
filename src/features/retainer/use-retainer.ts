import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { reconcileLocalNotifications } from '@/features/notifications/local-notifications';
import { getRetainerSnapshot, reconcileAutomaticOut, subscribeTracking, toggleRetainers, type RetainerSnapshot } from './retainer-repository';
export function useRetainer() {
  const db = useSQLiteContext();
  const [snapshot, setSnapshot] = useState<RetainerSnapshot | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const reload = useCallback(async () => { await reconcileAutomaticOut(db); setSnapshot(await getRetainerSnapshot(db)); setNow(Date.now()); }, [db]);
  useFocusEffect(useCallback(() => {
    const refresh = () => { void reload().catch(() => setError('Could not load retainer tracking. Please try again.')); };
    refresh();
    const unsubscribe = subscribeTracking(refresh);
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(timer); unsubscribe(); };
  }, [reload]));
  async function toggle() {
    if (pending.current || !snapshot) return;
    pending.current = true; setBusy(true); setError(null);
    try { await toggleRetainers(db, snapshot.punches[0].id); await reload(); void reconcileLocalNotifications(db); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not save.'); await reload().catch(() => undefined); }
    finally { pending.current = false; setBusy(false); }
  }
  return { snapshot, now, error, busy, toggle };
}
export function retainerDuration(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 3600)}h ${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}m ${String(seconds % 60).padStart(2, '0')}s`;
}
