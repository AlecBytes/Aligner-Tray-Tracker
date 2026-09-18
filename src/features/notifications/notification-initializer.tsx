import { useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { reconcileLocalNotifications } from '@/features/notifications/local-notifications';
import { automaticDeadline, getRetainerSnapshot, reconcileAutomaticOut, subscribeTracking, notifyTrackingChanged } from '@/features/retainer/retainer-repository';
export function NotificationInitializer() {
  const db = useSQLiteContext();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false; let running = false; let again = false;
    const refresh = async () => {
      if (running) { again = true; return; }
      if (disposed || AppState.currentState === 'background' || AppState.currentState === 'inactive') return;
      running = true;
      try {
        clearTimeout(timer);
        const before = await getRetainerSnapshot(db);
        await reconcileAutomaticOut(db);
        const after = await getRetainerSnapshot(db);
        if (before?.punches[0]?.id !== after?.punches[0]?.id) notifyTrackingChanged();
        const deadline = after ? automaticDeadline(after) : null;
        if (!disposed && deadline !== null) timer = setTimeout(() => void refresh(), Math.min(2147483647, Math.max(1, deadline - Date.now())));
        void reconcileLocalNotifications(db);
      } catch { /* A later foreground action retries without blocking local navigation. */ }
      finally { running = false; if (again) { again = false; void refresh(); } }
    };
    void refresh();
    const unsubscribe = subscribeTracking(() => void refresh());
    const subscription = AppState.addEventListener('change', (state) => { clearTimeout(timer); if (state === 'active') void refresh(); });
    return () => { disposed = true; clearTimeout(timer); unsubscribe(); subscription.remove(); };
  }, [db]);
  return null;
}
