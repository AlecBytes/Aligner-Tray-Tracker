import {
  applyTrackerRedo,
  applyTrackerUndo,
  clearTrackerSessionHistory,
  getTrackerSessionHistory,
  rememberTrackerRedo,
  rememberTrackerToggle,
  rememberTrackerUndo,
  validateTrackerSessionHistory,
} from '@/features/tracker/tracker-history-session';
import { createTrackerReadModel, getLatestWearPunch } from '@/features/tracker/tracker-calculations';
import type { TrackerSnapshot, TrackerToggleAction } from '@/features/tracker/tracker-model';

const predecessor = { id: 90, status: 'IN' as const, timestamp: 900 };
const action: TrackerToggleAction = {
  predecessor,
  punch: { id: 91, status: 'OUT', timestamp: 1000 },
  trayPeriodId: 33,
};

function snapshotWithPunches(punches: TrackerSnapshot['punches']): TrackerSnapshot {
  return {
    currentTrayNumber: 9,
    daysPerTray: 7,
    punches,
    totalTrays: 48,
    trayPeriodId: 33,
    trayStartedAt: 100,
  };
}

describe('tracker session undo and redo history', () => {
  beforeEach(() => {
    clearTrackerSessionHistory();
  });

  it('cycles a toggle through undo, redo, and undo again', () => {
    expect(rememberTrackerToggle(action)).toEqual({
      redoAction: null,
      undoAction: action,
    });
    expect(rememberTrackerUndo(action)).toEqual({
      redoAction: action,
      undoAction: null,
    });

    const restoredPunch = { ...action.punch, id: 92 };
    const restoredState = rememberTrackerRedo(restoredPunch);
    expect(restoredState).toEqual({
      redoAction: null,
      undoAction: { ...action, punch: restoredPunch },
    });
    expect(rememberTrackerUndo(restoredState.undoAction!)).toEqual({
      redoAction: { ...action, punch: restoredPunch },
      undoAction: null,
    });
  });

  it('clears redo when a new toggle succeeds', () => {
    rememberTrackerToggle(action);
    rememberTrackerUndo(action);

    const nextAction: TrackerToggleAction = {
      predecessor,
      punch: { id: 93, status: 'OUT', timestamp: 1100 },
      trayPeriodId: 33,
    };

    expect(rememberTrackerToggle(nextAction)).toEqual({
      redoAction: null,
      undoAction: nextAction,
    });
  });

  it('keeps undo only while its punch is still the latest persisted event', () => {
    rememberTrackerToggle(action);

    expect(validateTrackerSessionHistory(snapshotWithPunches([predecessor, action.punch]))).toEqual(
      getTrackerSessionHistory(),
    );
    expect(
      validateTrackerSessionHistory(
        snapshotWithPunches([
          predecessor,
          action.punch,
          { id: 92, status: 'IN', timestamp: 1100 },
        ]),
      ),
    ).toEqual({ redoAction: null, undoAction: null });
  });

  it('keeps redo only while its predecessor is still the latest persisted event', () => {
    rememberTrackerToggle(action);
    rememberTrackerUndo(action);

    expect(validateTrackerSessionHistory(snapshotWithPunches([predecessor]))).toEqual(
      getTrackerSessionHistory(),
    );
    expect(
      validateTrackerSessionHistory(
        snapshotWithPunches([
          predecessor,
          { id: 92, status: 'OUT', timestamp: 950 },
        ]),
      ),
    ).toEqual({ redoAction: null, undoAction: null });
  });

  it('clears history when the active tray changes or disappears', () => {
    rememberTrackerToggle(action);
    expect(
      validateTrackerSessionHistory({
        ...snapshotWithPunches([predecessor, action.punch]),
        trayPeriodId: 34,
      }),
    ).toEqual({ redoAction: null, undoAction: null });

    rememberTrackerToggle(action);
    expect(validateTrackerSessionHistory(null)).toEqual({
      redoAction: null,
      undoAction: null,
    });
  });

  it('updates the tracker status, totals, and latest event through undo and redo', () => {
    const dayStart = new Date(2026, 7, 15).getTime();
    const timedAction: TrackerToggleAction = {
      predecessor: { id: 90, status: 'IN', timestamp: dayStart },
      punch: { id: 91, status: 'OUT', timestamp: dayStart + 60 * 60 * 1000 },
      trayPeriodId: 33,
    };
    const initialSnapshot = snapshotWithPunches([
      timedAction.predecessor,
      timedAction.punch,
    ]);
    const now = dayStart + 2 * 60 * 60 * 1000;

    const undoneSnapshot = applyTrackerUndo(initialSnapshot, timedAction);
    expect(createTrackerReadModel(undoneSnapshot, now)).toMatchObject({
      currentStatus: 'IN',
      inTodaySeconds: 2 * 60 * 60,
      outTodaySeconds: 0,
    });
    expect(getLatestWearPunch(undoneSnapshot.punches)).toEqual(timedAction.predecessor);

    const restoredPunch = { ...timedAction.punch, id: 92 };
    const redoneSnapshot = applyTrackerRedo(undoneSnapshot, restoredPunch);
    expect(createTrackerReadModel(redoneSnapshot, now)).toMatchObject({
      currentStatus: 'OUT',
      inTodaySeconds: 60 * 60,
      outTodaySeconds: 60 * 60,
    });
    expect(getLatestWearPunch(redoneSnapshot.punches)).toEqual(restoredPunch);
  });
});
