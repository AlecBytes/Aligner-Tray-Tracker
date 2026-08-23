import type { ManualBackupResult } from '@/features/cloud-backup/manual-backup-core';

type ManualBackupScreenOperationOptions = {
  perform: () => Promise<ManualBackupResult>;
  onStart: () => void;
  onResult: (result: ManualBackupResult) => void;
  onFinish: () => void;
};

export function createManualBackupScreenOperation({
  perform,
  onStart,
  onResult,
  onFinish,
}: ManualBackupScreenOperationOptions) {
  let active = true;
  let inFlight = false;

  return {
    async start() {
      if (!active || inFlight) return false;

      inFlight = true;
      onStart();
      const result = await perform();
      inFlight = false;

      if (active) {
        onResult(result);
        onFinish();
      }
      return true;
    },
    dispose() {
      active = false;
    },
  };
}
