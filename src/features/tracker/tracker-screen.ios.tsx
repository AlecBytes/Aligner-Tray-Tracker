import { createTrackerReadModel, getLatestWearPunch } from './tracker-calculations';
import { useIOSTracker } from './use-ios-tracker';
import { TrackerPresentation, TrackerUnavailable } from './tracker-presentation';

export function TrackerScreen() {
  const controller = useIOSTracker();
  const { snapshot, history, now, isLoading, error, refreshTracker } = controller;
  if (!snapshot) return <TrackerUnavailable loading={isLoading} error={error} retry={refreshTracker} />;

  const treatment = createTrackerReadModel(snapshot, now);
  const latestPunch = getLatestWearPunch(snapshot.punches);
  return <TrackerPresentation {...controller} status={treatment.currentStatus} treatment={treatment} latestPunch={latestPunch} canEdit={latestPunch !== null} canUndo={history.undoAction !== null} canRedo={history.redoAction !== null} />;
}
