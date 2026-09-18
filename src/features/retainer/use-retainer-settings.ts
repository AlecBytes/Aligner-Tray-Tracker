import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { getLocalNotificationPermissionState, reconcileLocalNotifications } from '@/features/notifications/local-notifications';
import { refreshWatchTrackerSnapshot } from '@/features/siri/aligner-tracker-intents';
import { disableRetainerMode, enableRetainerMode, getRetainerSettings, saveRetainerSettings, type RetainerSettings } from './retainer-repository';
import { useTrackingMode } from './use-tracking-mode';
export function useRetainerSettings() {
  const db = useSQLiteContext(); const router = useRouter(); const { mode } = useTrackingMode();
  const [settings, setSettings] = useState<RetainerSettings | null>(null);
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState(''); const pending = useRef(false);
  useFocusEffect(useCallback(() => { void getRetainerSettings(db).then(setSettings).catch(() => setError('Could not load settings.')); void getLocalNotificationPermissionState().then(setPermission); }, [db]));
  async function perform(action: () => Promise<void>) {
    if (pending.current) return; pending.current = true; setBusy(true); setError(null);
    try { await action(); void refreshWatchTrackerSnapshot(); void reconcileLocalNotifications(db, { requestPermission: true }).then(() => getLocalNotificationPermissionState().then(setPermission)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not save settings.'); }
    finally { pending.current = false; setBusy(false); }
  }
  function switchMode() { return perform(async () => { if (mode?.kind === 'retainer') { await disableRetainerMode(db); router.replace('/setup'); } else { await enableRetainerMode(db); router.replace('/tracker'); } }); }
  function save(value: RetainerSettings) { return perform(async () => { await saveRetainerSettings(db, value); setSettings(value); }); }
  return { settings, mode, error, busy, permission, switchMode, save };
}
export const enableMessage = 'Turning on Retainer Mode will complete your current treatment plan and switch the tracker to nighttime retainer tracking. Your treatment history will be preserved.';
export const disableMessage = "You'll return to Treatment Setup to begin a new treatment plan. Your previous treatment and retainer history will be preserved.";
