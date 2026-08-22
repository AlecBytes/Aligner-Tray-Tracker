import { getLatestWearPunch } from '@/features/tracker/tracker-calculations';
import type {
  TrackerSnapshot,
  TrackerToggleAction,
  WearPunchEvent,
} from '@/features/tracker/tracker-model';

export type TrackerHistoryState = {
  redoAction: TrackerToggleAction | null;
  undoAction: TrackerToggleAction | null;
};

const EMPTY_HISTORY: TrackerHistoryState = {
  redoAction: null,
  undoAction: null,
};

let sessionHistory = EMPTY_HISTORY;

function punchesMatch(left: WearPunchEvent | null, right: WearPunchEvent) {
  return (
    left !== null &&
    left.id === right.id &&
    left.status === right.status &&
    left.timestamp === right.timestamp
  );
}

export function getTrackerSessionHistory() {
  return sessionHistory;
}

export function rememberTrackerToggle(action: TrackerToggleAction) {
  sessionHistory = { redoAction: null, undoAction: action };
  return sessionHistory;
}

export function rememberTrackerUndo(action: TrackerToggleAction) {
  sessionHistory = { redoAction: action, undoAction: null };
  return sessionHistory;
}

export function rememberTrackerRedo(restoredPunch: WearPunchEvent) {
  const action = sessionHistory.redoAction;

  if (action === null) {
    sessionHistory = EMPTY_HISTORY;
    return sessionHistory;
  }

  sessionHistory = {
    redoAction: null,
    undoAction: { ...action, punch: restoredPunch },
  };
  return sessionHistory;
}

export function clearTrackerSessionHistory() {
  sessionHistory = EMPTY_HISTORY;
  return sessionHistory;
}

export function applyTrackerUndo(snapshot: TrackerSnapshot, action: TrackerToggleAction) {
  const remainingPunches = snapshot.punches.filter((punch) => punch.id !== action.punch.id);

  return {
    ...snapshot,
    punches: remainingPunches.some((punch) => punch.id === action.predecessor.id)
      ? remainingPunches
      : [...remainingPunches, action.predecessor],
  };
}

export function applyTrackerRedo(snapshot: TrackerSnapshot, restoredPunch: WearPunchEvent) {
  return { ...snapshot, punches: [...snapshot.punches, restoredPunch] };
}

export function validateTrackerSessionHistory(snapshot: TrackerSnapshot | null) {
  if (snapshot === null) {
    return clearTrackerSessionHistory();
  }

  const action = sessionHistory.undoAction ?? sessionHistory.redoAction;

  if (action === null) {
    return sessionHistory;
  }

  const expectedLatest = sessionHistory.undoAction?.punch ?? action.predecessor;
  const latestPunch = getLatestWearPunch(snapshot.punches);

  if (
    snapshot.trayPeriodId !== action.trayPeriodId ||
    !punchesMatch(latestPunch, expectedLatest)
  ) {
    return clearTrackerSessionHistory();
  }

  return sessionHistory;
}
