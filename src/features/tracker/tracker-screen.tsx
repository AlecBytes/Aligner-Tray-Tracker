import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';

import { reconcileLocalNotifications } from '@/features/notifications/local-notifications';
import {
  createTrackerReadModel,
  getLatestWearPunch,
} from '@/features/tracker/tracker-calculations';
import {
  applyTrackerRedo,
  applyTrackerUndo,
  getTrackerSessionHistory,
  rememberTrackerRedo,
  rememberTrackerToggle,
  rememberTrackerUndo,
  validateTrackerSessionHistory,
} from '@/features/tracker/tracker-history-session';
import type { TrackerSnapshot } from '@/features/tracker/tracker-model';
import {
  getTrackerSnapshot,
  redoWearStatus,
  toggleWearStatus,
  undoWearStatus,
} from '@/features/tracker/tracker-repository';
import { TrackerPresentation, TrackerUnavailable } from './tracker-presentation';

export function TrackerScreen() {
  const db = useSQLiteContext();
  const mutationInProgress = useRef(false);
  const [snapshot, setSnapshot] = useState<TrackerSnapshot | null>(null);
  const [history, setHistory] = useState(getTrackerSessionHistory);
  const [now, setNow] = useState(() => Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readPersistedTracker = useCallback(async () => {
    const readAt = Date.now();
    const persistedSnapshot = await getTrackerSnapshot(db, readAt);
    return { persistedSnapshot, readAt };
  }, [db]);

  const refreshTracker = useCallback(async () => {
    setIsLoading(true);

    try {
      const { persistedSnapshot, readAt } = await readPersistedTracker();
      setSnapshot(persistedSnapshot);
      setHistory(validateTrackerSessionHistory(persistedSnapshot));
      setNow(readAt);
      setError(
        persistedSnapshot === null ? 'No active treatment was found. Complete treatment setup first.' : null,
      );
    } catch {
      setError('The saved tracker could not be loaded. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [readPersistedTracker]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      setIsLoading(true);
      void readPersistedTracker()
        .then(({ persistedSnapshot, readAt }) => {
          if (!active) {
            return;
          }

          setSnapshot(persistedSnapshot);
          setHistory(validateTrackerSessionHistory(persistedSnapshot));
          setNow(readAt);
          setError(
            persistedSnapshot === null
              ? 'No active treatment was found. Complete treatment setup first.'
              : null,
          );
        })
        .catch(() => {
          if (active) {
            setError('The saved tracker could not be loaded. Please try again.');
          }
        })
        .finally(() => {
          if (active) {
            setIsLoading(false);
          }
        });

      const timer = setInterval(() => setNow(Date.now()), 1000);

      return () => {
        active = false;
        clearInterval(timer);
      };
    }, [readPersistedTracker]),
  );

  if (!snapshot) return <TrackerUnavailable loading={isLoading} error={error} retry={refreshTracker} />;

  const tracker = createTrackerReadModel(snapshot, now);
  const latestPunch = getLatestWearPunch(snapshot.punches);

  async function toggleTracker() {
    if (mutationInProgress.current || snapshot === null || latestPunch === null) {
      return;
    }

    const timestamp = Date.now();
    const persistedStatus = createTrackerReadModel(snapshot, timestamp).currentStatus;
    mutationInProgress.current = true;
    setIsMutating(true);
    setError(null);

    try {
      const punch = await toggleWearStatus(
        db,
        snapshot.trayPeriodId,
        persistedStatus,
        timestamp,
      );

      setSnapshot((currentSnapshot) =>
        currentSnapshot === null
          ? currentSnapshot
          : { ...currentSnapshot, punches: [...currentSnapshot.punches, punch] },
      );
      setHistory(
        rememberTrackerToggle({
          predecessor: latestPunch,
          punch,
          trayPeriodId: snapshot.trayPeriodId,
        }),
      );
      setNow(timestamp);
      void reconcileLocalNotifications(db);
    } catch {
      setError('The tracker could not be updated. Showing the last saved state.');

      try {
        const { persistedSnapshot, readAt } = await readPersistedTracker();
        setSnapshot(persistedSnapshot);
        setHistory(validateTrackerSessionHistory(persistedSnapshot));
        setNow(readAt);
      } catch {
        // Keep the last successfully loaded state visible.
      }
    } finally {
      mutationInProgress.current = false;
      setIsMutating(false);
    }
  }

  async function undoTracker() {
    const action = history.undoAction;

    if (mutationInProgress.current || action === null) {
      return;
    }

    mutationInProgress.current = true;
    setIsMutating(true);
    setError(null);

    try {
      await undoWearStatus(db, action);
      setSnapshot((currentSnapshot) =>
        currentSnapshot === null ? currentSnapshot : applyTrackerUndo(currentSnapshot, action),
      );
      setHistory(rememberTrackerUndo(action));
      setNow(Date.now());
      void reconcileLocalNotifications(db);
    } catch {
      setError('The tracker change could not be undone. Showing the last saved state.');

      try {
        const { persistedSnapshot, readAt } = await readPersistedTracker();
        setSnapshot(persistedSnapshot);
        setHistory(validateTrackerSessionHistory(persistedSnapshot));
        setNow(readAt);
      } catch {
        // Keep the last successfully loaded state visible.
      }
    } finally {
      mutationInProgress.current = false;
      setIsMutating(false);
    }
  }

  async function redoTracker() {
    const action = history.redoAction;

    if (mutationInProgress.current || action === null) {
      return;
    }

    mutationInProgress.current = true;
    setIsMutating(true);
    setError(null);

    try {
      const restoredPunch = await redoWearStatus(db, action);
      setSnapshot((currentSnapshot) =>
        currentSnapshot === null
          ? currentSnapshot
          : applyTrackerRedo(currentSnapshot, restoredPunch),
      );
      setHistory(rememberTrackerRedo(restoredPunch));
      setNow(Date.now());
      void reconcileLocalNotifications(db);
    } catch {
      setError('The tracker change could not be redone. Showing the last saved state.');

      try {
        const { persistedSnapshot, readAt } = await readPersistedTracker();
        setSnapshot(persistedSnapshot);
        setHistory(validateTrackerSessionHistory(persistedSnapshot));
        setNow(readAt);
      } catch {
        // Keep the last successfully loaded state visible.
      }
    } finally {
      mutationInProgress.current = false;
      setIsMutating(false);
    }
  }

  return <TrackerPresentation status={tracker.currentStatus} treatment={tracker} latestPunch={latestPunch} canEdit={latestPunch !== null} canUndo={history.undoAction !== null} canRedo={history.redoAction !== null} isLoading={isLoading} isMutating={isMutating} actionsDisabled={isMutating} error={error} needsRetry={false} refreshTracker={refreshTracker} toggleTracker={toggleTracker} undoTracker={undoTracker} redoTracker={redoTracker} />;
}
