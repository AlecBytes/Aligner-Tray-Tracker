import {
  BACKUP_SNAPSHOT_SCHEMA_VERSION,
  BackupSnapshotValidationError,
  canonicalBackupSnapshotEnvelopeJson,
  computeBackupSnapshotContentHash,
  type BackupSnapshotEnvelopeV1,
  validateBackupSnapshotEnvelope,
} from '@/features/cloud-backup/backup-snapshot';
import {
  CloudRestoreOperationError,
  MAX_BACKUP_SNAPSHOT_BYTES,
  type RecoveryPoint,
} from '@/features/cloud-backup/cloud-restore-core';

function invalidSnapshot(): never {
  throw new CloudRestoreOperationError('invalidSnapshot');
}

export function validateRestorableBackupSnapshotV1(
  envelope: BackupSnapshotEnvelopeV1,
) {
  const { payload } = envelope;
  if (payload.treatments.length !== 1) invalidSnapshot();
  if (
    payload.treatmentPlanVersions.length === 0 ||
    payload.trayPeriods.length === 0 ||
    payload.wearPunches.length === 0
  ) {
    invalidSnapshot();
  }

  const treatmentId = payload.treatments[0].id;
  if (
    payload.treatmentPlanVersions.some((plan) => plan.treatmentId !== treatmentId) ||
    payload.trayPeriods.some((period) => period.treatmentId !== treatmentId)
  ) {
    invalidSnapshot();
  }

  const activePeriods = payload.trayPeriods.filter((period) => period.endedAt === null);
  if (
    activePeriods.length !== 1 ||
    payload.trayPeriods.at(-1)?.id !== activePeriods[0].id
  ) {
    invalidSnapshot();
  }

  for (let index = 1; index < payload.trayPeriods.length; index += 1) {
    const previous = payload.trayPeriods[index - 1];
    const current = payload.trayPeriods[index];
    if (previous.endedAt === null || previous.endedAt > current.startedAt) {
      invalidSnapshot();
    }
  }

  const punchesByPeriod = new Map<number, typeof payload.wearPunches>();
  for (const punch of payload.wearPunches) {
    const punches = punchesByPeriod.get(punch.trayPeriodId) ?? [];
    punches.push(punch);
    punchesByPeriod.set(punch.trayPeriodId, punches);
  }

  for (const period of payload.trayPeriods) {
    const punches = punchesByPeriod.get(period.id);
    if (!punches || punches.length === 0) invalidSnapshot();

    for (let index = 0; index < punches.length; index += 1) {
      const punch = punches[index];
      const previous = punches[index - 1];
      if (
        punch.timestamp < period.startedAt ||
        (period.endedAt !== null && punch.timestamp > period.endedAt) ||
        (previous &&
          (punch.timestamp <= previous.timestamp || punch.status === previous.status))
      ) {
        invalidSnapshot();
      }
    }
  }

  const latestPlan = payload.treatmentPlanVersions.at(-1);
  if (!latestPlan || activePeriods[0].trayNumber > latestPlan.totalTrays) {
    invalidSnapshot();
  }

  return envelope;
}

function decodeUtf8(bytes: ArrayBuffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return invalidSnapshot();
  }
}

export async function validateDownloadedBackupSnapshot(
  bytes: ArrayBuffer,
  recoveryPoint: RecoveryPoint,
) {
  if (
    bytes.byteLength <= 0 ||
    bytes.byteLength > MAX_BACKUP_SNAPSHOT_BYTES ||
    bytes.byteLength !== recoveryPoint.payloadBytes
  ) {
    invalidSnapshot();
  }
  if (!recoveryPoint.supported || recoveryPoint.schemaVersion !== BACKUP_SNAPSHOT_SCHEMA_VERSION) {
    throw new CloudRestoreOperationError('incompatible');
  }

  const text = decodeUtf8(bytes);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return invalidSnapshot();
  }

  let envelope: BackupSnapshotEnvelopeV1;
  try {
    envelope = validateBackupSnapshotEnvelope(parsed);
  } catch (error) {
    if (error instanceof BackupSnapshotValidationError) return invalidSnapshot();
    throw error;
  }

  if (
    envelope.schemaVersion !== recoveryPoint.schemaVersion ||
    envelope.sourceAppVersion !== recoveryPoint.appVersion ||
    canonicalBackupSnapshotEnvelopeJson(envelope) !== text
  ) {
    invalidSnapshot();
  }

  const contentHash = await computeBackupSnapshotContentHash(envelope);
  if (contentHash !== recoveryPoint.contentHash) invalidSnapshot();
  return validateRestorableBackupSnapshotV1(envelope);
}
