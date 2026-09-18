import { retainerPunchMatches, undonePredecessor, type RetainerSnapshot, type RetainerToggleAction } from './retainer-repository';

export type RetainerHistory = { undoAction: RetainerToggleAction | null; redoAction: RetainerToggleAction | null };
const empty: RetainerHistory = { undoAction: null, redoAction: null };
let history = empty;
export function setRetainerHistory(value: RetainerHistory) { history = value; return history; }
export function clearRetainerHistory() { return setRetainerHistory(empty); }
export function validateRetainerHistory(snapshot: RetainerSnapshot | null) {
  const action = history.undoAction ?? history.redoAction;
  if (!snapshot) return clearRetainerHistory();
  if (action && (snapshot.period.id !== action.periodId
    || !retainerPunchMatches(snapshot.punches[0], history.undoAction ? action.punch : undonePredecessor(action))
    || (history.undoAction && !retainerPunchMatches(snapshot.punches[1], action.predecessor)))) return clearRetainerHistory();
  return history;
}
