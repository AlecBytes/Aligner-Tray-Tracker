import type {
  CloudRestoreResult,
  RecoveryPoint,
} from '@/features/cloud-backup/cloud-restore-core';

type CloudRestoreScreenOperationOptions = {
  perform: (recoveryPoint: RecoveryPoint, signal: AbortSignal) => Promise<CloudRestoreResult>;
  onFinish: () => void;
  onResult: (result: CloudRestoreResult) => void;
  onStart: () => void;
};

export function createCloudRestoreScreenOperation({
  perform,
  onFinish,
  onResult,
  onStart,
}: CloudRestoreScreenOperationOptions) {
  let active = true;
  let controller: AbortController | null = null;
  let inFlight = false;

  return {
    async start(recoveryPoint: RecoveryPoint) {
      if (!active || inFlight) return false;

      inFlight = true;
      controller = new AbortController();
      onStart();
      const result = await perform(recoveryPoint, controller.signal);
      controller = null;
      inFlight = false;

      if (active) {
        onResult(result);
        onFinish();
      }
      return true;
    },
    dispose() {
      active = false;
      controller?.abort();
      controller = null;
    },
  };
}
