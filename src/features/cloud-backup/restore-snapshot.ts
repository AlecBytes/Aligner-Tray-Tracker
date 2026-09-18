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
  if (envelope.schemaVersion === 2) return validateRestorableV2(envelope);
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
  if (!recoveryPoint.supported || ![1, BACKUP_SNAPSHOT_SCHEMA_VERSION].includes(recoveryPoint.schemaVersion)) {
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

function validateRestorableV2(envelope: BackupSnapshotEnvelopeV1) {
  const p = envelope.payload; const data = p.retainerData;
  if (!data || !p.treatments.length) invalidSnapshot();
  const activeTreatments = p.treatments.filter((t) => t.completedAt === null);
  const activeTrays = p.trayPeriods.filter((t) => t.endedAt === null);
  const activeRetainers = data.periods.filter((t) => t.ended_at === null);
  if (activeTreatments.length > 1 || activeTrays.length !== activeTreatments.length || activeRetainers.length > 1 || (activeRetainers.length && activeTreatments.length)) invalidSnapshot();
  for (const treatment of p.treatments) {
    const trays = p.trayPeriods.filter((t) => t.treatmentId === treatment.id).sort((a,b) => a.startedAt-b.startedAt || a.id-b.id);
    const plans = p.treatmentPlanVersions.filter((t) => t.treatmentId === treatment.id);
    if (!trays.length || !plans.length || (treatment.completedAt != null && treatment.completedAt < treatment.createdAt)) invalidSnapshot();
    if (treatment.completedAt === null && trays.at(-1)?.endedAt !== null) invalidSnapshot();
    for (let index = 0; index < trays.length; index++) {
      const tray = trays[index]; const previous = trays[index-1];
      if (tray.startedAt < treatment.createdAt || (previous && (previous.endedAt === null || previous.endedAt > tray.startedAt))) invalidSnapshot();
      if (treatment.completedAt != null && (tray.endedAt === null || tray.endedAt > treatment.completedAt)) invalidSnapshot();
      const punches = p.wearPunches.filter((w) => w.trayPeriodId === tray.id).sort((a,b) => a.timestamp-b.timestamp || a.id-b.id);
      validateTimeline(punches, tray.startedAt, tray.endedAt);
    }
  }
  for (const period of data.periods) {
    const treatment = p.treatments.find((t) => t.id === period.treatment_id);
    if (!treatment || treatment.completedAt == null || period.started_at < treatment.completedAt || (period.ended_at !== null && period.ended_at < period.started_at)) invalidSnapshot();
    const punches = data.punches.filter((w) => w.retainer_period_id === period.id).sort((a,b) => a.timestamp-b.timestamp || a.id-b.id);
    validateTimeline(punches, period.started_at, period.ended_at);
    if (punches[0].status !== 'OUT' || punches[0].timestamp !== period.started_at || (period.ended_at !== null && punches.at(-1)?.status !== 'OUT')) invalidSnapshot();
  }
  if (data.punches.some((w) => !data.periods.some((t) => t.id === w.retainer_period_id))) invalidSnapshot();
  const intervals = [...p.treatments.map((t) => ({ start: t.createdAt, end: t.completedAt ?? null })), ...data.periods.map((t) => ({ start: t.started_at, end: t.ended_at }))].sort((a,b) => a.start-b.start);
  for (let i=1;i<intervals.length;i++) if (intervals[i-1].end === null || intervals[i-1].end! > intervals[i].start) invalidSnapshot();
  return envelope;
}
function validateTimeline(punches: { status: string; timestamp: number }[], start: number, end: number | null) {
  if (!punches.length) invalidSnapshot();
  for (let i=0;i<punches.length;i++) {
    const punch = punches[i]; const previous = punches[i-1];
    if (punch.timestamp < start || (end !== null && punch.timestamp > end) || (previous && (previous.timestamp >= punch.timestamp || previous.status === punch.status))) invalidSnapshot();
  }
}
