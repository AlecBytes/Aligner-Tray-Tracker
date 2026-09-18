import { TrackerPresentation, TrackerUnavailable } from '@/features/tracker/tracker-presentation';
import { createRetainerTrackerModel } from './retainer-tracker-model';
import { useRetainer } from './use-retainer';

/** Retainer data controller for the shared, platform-specific tracker presentation. */
export function RetainerTrackerScreen() {
  const { snapshot, history, now, error, busy, isLoading, needsRetry, reload, toggle, undo, redo } = useRetainer();
  if (!snapshot) return <TrackerUnavailable loading={isLoading} error={error} retry={reload} />;
  const latest = snapshot.punches[0];
  return <TrackerPresentation
    status={latest.status}
    retainer={createRetainerTrackerModel(snapshot, now)}
    latestPunch={latest}
    canEdit={latest.origin !== 'lifecycle'}
    canUndo={history.undoAction !== null}
    canRedo={history.redoAction !== null}
    isLoading={isLoading}
    isMutating={busy}
    actionsDisabled={busy || needsRetry}
    error={error}
    needsRetry={needsRetry}
    refreshTracker={reload}
    toggleTracker={toggle}
    undoTracker={undo}
    redoTracker={redo}
  />;
}
