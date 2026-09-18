import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { reconcileLocalNotifications } from '@/features/notifications/local-notifications';
import type { TrackerToggleOutcome } from '@/features/tracker/use-ios-tracker';
import { getRetainerSnapshot, reconcileAutomaticOut, subscribeTracking, toggleRetainers, undoRetainerToggle, redoRetainerToggle, type RetainerSnapshot } from './retainer-repository';
import { clearRetainerHistory, setRetainerHistory, validateRetainerHistory, type RetainerHistory } from './retainer-history-session';

export function useRetainer() {
  const db = useSQLiteContext();
  const [snapshot, setSnapshot] = useState<RetainerSnapshot | null>(null);
  const [history, setHistory] = useState<RetainerHistory>({ undoAction: null, redoAction: null });
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isLoading, setLoading] = useState(true);
  const [needsRetry, setNeedsRetry] = useState(false);
  const pending = useRef(false);
  const generation = useRef(0);
  const request = useRef(0);
  const active = useRef(false);
  const refreshQueued = useRef(false);
  const reload = useCallback(async () => {
    if (pending.current) { refreshQueued.current = true; return; }
    const current = ++request.current;
    const lifecycle = generation.current;
    try {
      await reconcileAutomaticOut(db);
      const value = await getRetainerSnapshot(db);
      if (!active.current || lifecycle !== generation.current || current !== request.current) return;
      setSnapshot(value); setHistory(validateRetainerHistory(value)); setNow(Date.now());
      setNeedsRetry(false); setError(value ? null : 'No active retainer period was found.');
    } catch {
      if (active.current && lifecycle === generation.current && current === request.current) {
        setError('Could not load retainer tracking. Please try again.'); setNeedsRetry(true);
      }
    } finally {
      if (active.current && lifecycle === generation.current && current === request.current) setLoading(false);
    }
  }, [db]);
  useFocusEffect(useCallback(() => {
    active.current = true; generation.current += 1;
    void reload();
    const unsubscribe = subscribeTracking(() => void reload());
    const subscription = AppState.addEventListener('change', state => {
      generation.current += 1;
      active.current = state === 'active';
      if (active.current) void reload();
    });
    const timer = setInterval(() => { if (active.current) setNow(Date.now()); }, 1000);
    return () => { active.current = false; generation.current += 1; request.current += 1; clearInterval(timer); unsubscribe(); subscription.remove(); };
  }, [reload]));

  async function mutate(kind: 'toggle' | 'undo' | 'redo', feedback?: (outcome: TrackerToggleOutcome) => void) {
    if (pending.current || !snapshot || needsRetry || !active.current) return;
    const action = kind === 'undo' ? history.undoAction : history.redoAction;
    if (kind !== 'toggle' && !action) return;
    const timestamp = Date.now();
    const lifecycle = generation.current;
    pending.current = true; request.current += 1; setBusy(true); setError(null);
    let committed = false;
    const report = (outcome: TrackerToggleOutcome) => {
      if (active.current && lifecycle === generation.current) { try { feedback?.(outcome); } catch { /* Feedback is supplemental. */ } }
    };
    try {
      let next: RetainerSnapshot;
      let nextHistory: RetainerHistory;
      if (kind === 'toggle') {
        const result = await toggleRetainers(db, snapshot.punches[0], timestamp);
        committed = true;
        next = result.snapshot;
        nextHistory = result.action ? setRetainerHistory({ undoAction: result.action, redoAction: null }) : clearRetainerHistory();
        if (result.action) report({ kind: 'changed', status: result.action.punch.status });
      } else if (kind === 'undo') {
        next = await undoRetainerToggle(db, action!); committed = true;
        nextHistory = setRetainerHistory({ undoAction: null, redoAction: action });
      } else {
        const result = await redoRetainerToggle(db, action!); committed = true;
        next = result.snapshot; nextHistory = setRetainerHistory({ undoAction: result.action, redoAction: null });
      }
      if (active.current && lifecycle === generation.current) {
        setSnapshot(next); setHistory(nextHistory); setNow(timestamp);
      }
      void reconcileLocalNotifications(db).catch(() => undefined);
    } catch (failure) {
      if (!committed) {
        if (kind === 'toggle') report({ kind: 'failed' });
        clearRetainerHistory();
        if (active.current && lifecycle === generation.current) {
          setHistory({ undoAction: null, redoAction: null });
          setError(failure instanceof Error ? failure.message : 'Could not save. Please try again.'); setNeedsRetry(true);
        }
      }
    } finally {
      pending.current = false;
      setBusy(false);
      // Subscription refreshes during a write cannot replace its committed result.
      if (refreshQueued.current) { refreshQueued.current = false; if (committed) void reload(); }
    }
  }
  return { snapshot, history, now, error, busy, isLoading, needsRetry, reload,
    toggle: (feedback?: (outcome: TrackerToggleOutcome) => void) => mutate('toggle', feedback),
    undo: () => mutate('undo'), redo: () => mutate('redo') };
}