import type { TrackerReadModel, WearPunchEvent } from './tracker-model';
import type { TrackerToggleOutcome } from './use-ios-tracker';

export type TrackerPresentationProps = {
  status: 'IN' | 'OUT';
  treatment?: TrackerReadModel;
  retainer?: { periodId: number; durationLabel: string; duration: string; reminder: string };
  latestPunch: WearPunchEvent | null;
  canEdit: boolean;
  canUndo: boolean;
  canRedo: boolean;
  isLoading: boolean;
  isMutating: boolean;
  actionsDisabled: boolean;
  error: string | null;
  needsRetry: boolean;
  refreshTracker: () => Promise<void>;
  toggleTracker: (feedback?: (outcome: TrackerToggleOutcome) => void) => Promise<unknown>;
  undoTracker: () => Promise<unknown>;
  redoTracker: () => Promise<unknown>;
};
