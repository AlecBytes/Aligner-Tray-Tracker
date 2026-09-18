import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { getTrackingMode, subscribeTracking, type TrackingMode } from './retainer-repository';
export function useTrackingMode() {
  const db = useSQLiteContext();
  const [mode, setMode] = useState<TrackingMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  useFocusEffect(useCallback(() => {
    let active = true;
    const reload = () => { void getTrackingMode(db).then((value) => { if (active) { setMode(value); setError(null); } }).catch(() => { if (active) setError('Local tracking data is unavailable.'); }); };
    reload();
    const unsubscribe = subscribeTracking(reload);
    return () => { active = false; unsubscribe(); };
  }, [db]));
  return { mode, error };
}
