type TrackerToggleMilestone =
  | 'handler-entry'
  | 'sqlite-commit-confirmed'
  | 'js-result-received'
  | 'visual-state-scheduled'
  | 'readback-complete'
  | 'notification-complete';

export type TrackerToggleMeasurement = {
  mark: (milestone: TrackerToggleMilestone, detail?: Record<string, number | string>) => void;
};

let nextOperationId = 1;

const disabledMeasurement: TrackerToggleMeasurement = { mark() {} };

export function startTrackerToggleMeasurement(): TrackerToggleMeasurement {
  if (!__DEV__ || process.env.EXPO_PUBLIC_TRACKER_PERFORMANCE !== '1') {
    return disabledMeasurement;
  }

  const operationId = nextOperationId++;
  const startedAt = performance.now();
  return {
    mark(milestone, detail = {}) {
      // Development-only, opt-in structured output for real-device baselines.
      console.info('[tracker-toggle-performance]', {
        elapsedMs: performance.now() - startedAt,
        milestone,
        operationId,
        ...detail,
      });
    },
  };
}
