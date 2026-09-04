import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

export const BACKUP_SNAPSHOT_SCHEMA_VERSION = 1 as const;

export type BackupTreatmentV1 = {
  id: number;
  createdAt: number;
};

export type BackupTreatmentPlanVersionV1 = {
  id: number;
  treatmentId: number;
  totalTrays: number;
  daysPerTray: number;
  dailyWearGoalMinutes: number;
  effectiveAt: number;
  createdAt: number;
};

export type BackupTrayPeriodV1 = {
  id: number;
  treatmentId: number;
  trayNumber: number;
  startedAt: number;
  endedAt: number | null;
};

export type BackupWearPunchV1 = {
  id: number;
  trayPeriodId: number;
  status: 'IN' | 'OUT';
  timestamp: number;
};

export type BackupNotificationSettingsV1 = {
  outReminderEnabled: boolean;
  outReminderMinutes: number;
  outPersistentReminderIntervalMinutes: number;
  trayChangeReminderEnabled: boolean;
  trayChangeReminderHour: number;
  trayChangeReminderMinute: number;
};

export type BackupSnapshotPayloadV1 = {
  treatments: BackupTreatmentV1[];
  treatmentPlanVersions: BackupTreatmentPlanVersionV1[];
  trayPeriods: BackupTrayPeriodV1[];
  wearPunches: BackupWearPunchV1[];
  notificationSettings: BackupNotificationSettingsV1;
};

export type BackupSnapshotEnvelopeV1 = {
  schemaVersion: typeof BACKUP_SNAPSHOT_SCHEMA_VERSION;
  sourceAppVersion: string;
  payload: BackupSnapshotPayloadV1;
};

export type SerializedBackupSnapshot = {
  json: string;
  schemaVersion: typeof BACKUP_SNAPSHOT_SCHEMA_VERSION;
  sourceAppVersion: string;
  contentHash: string;
  payloadBytes: number;
};

export class BackupSnapshotValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupSnapshotValidationError';
  }
}

type TreatmentRow = {
  id: number;
  created_at: number;
};

type TreatmentPlanVersionRow = {
  id: number;
  treatment_id: number;
  total_trays: number;
  days_per_tray: number;
  daily_wear_goal_minutes: number;
  effective_at: number;
  created_at: number;
};

type TrayPeriodRow = {
  id: number;
  treatment_id: number;
  tray_number: number;
  started_at: number;
  ended_at: number | null;
};

type WearPunchRow = {
  id: number;
  tray_period_id: number;
  status: 'IN' | 'OUT';
  timestamp: number;
};

type NotificationSettingsRow = {
  out_reminder_enabled: number;
  out_reminder_minutes: number;
  out_persistent_reminder_interval_minutes: number;
  tray_change_reminder_enabled: number;
  tray_change_reminder_hour: number;
  tray_change_reminder_minute: number;
};

function validationError(path: string, expectation: string): never {
  throw new BackupSnapshotValidationError(`${path} ${expectation}.`);
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return validationError(path, 'must be an object');
  }

  return value as Record<string, unknown>;
}

function requireExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
  path: string,
) {
  const keys = Object.keys(value);
  if (
    keys.length !== expectedKeys.length ||
    expectedKeys.some((key) => !Object.hasOwn(value, key))
  ) {
    validationError(path, `must contain exactly: ${expectedKeys.join(', ')}`);
  }
}

function requireArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) return validationError(path, 'must be an array');
  return value;
}

function requireString(value: unknown, path: string) {
  if (typeof value !== 'string') return validationError(path, 'must be a string');
  return value;
}

function requireBoolean(value: unknown, path: string) {
  if (typeof value !== 'boolean') return validationError(path, 'must be a boolean');
  return value;
}

function requireSafeInteger(value: unknown, path: string) {
  if (!Number.isSafeInteger(value)) return validationError(path, 'must be a safe integer');
  return value as number;
}

function requireIntegerInRange(value: unknown, minimum: number, maximum: number, path: string) {
  const integer = requireSafeInteger(value, path);
  if (integer < minimum || integer > maximum) {
    validationError(path, `must be between ${minimum} and ${maximum}`);
  }
  return integer;
}

function requirePositiveInteger(value: unknown, path: string) {
  const integer = requireSafeInteger(value, path);
  if (integer <= 0) validationError(path, 'must be positive');
  return integer;
}

function requireUniqueIds(items: { id: number }[], path: string) {
  const ids = new Set<number>();
  for (const item of items) {
    if (ids.has(item.id)) validationError(path, `must not contain duplicate id ${item.id}`);
    ids.add(item.id);
  }
}

function validateTreatment(value: unknown, path: string): BackupTreatmentV1 {
  const record = requireRecord(value, path);
  requireExactKeys(record, ['id', 'createdAt'], path);
  return {
    id: requirePositiveInteger(record.id, `${path}.id`),
    createdAt: requireSafeInteger(record.createdAt, `${path}.createdAt`),
  };
}

function validateTreatmentPlanVersion(
  value: unknown,
  path: string,
): BackupTreatmentPlanVersionV1 {
  const record = requireRecord(value, path);
  requireExactKeys(
    record,
    [
      'id',
      'treatmentId',
      'totalTrays',
      'daysPerTray',
      'dailyWearGoalMinutes',
      'effectiveAt',
      'createdAt',
    ],
    path,
  );
  return {
    id: requirePositiveInteger(record.id, `${path}.id`),
    treatmentId: requirePositiveInteger(record.treatmentId, `${path}.treatmentId`),
    totalTrays: requirePositiveInteger(record.totalTrays, `${path}.totalTrays`),
    daysPerTray: requirePositiveInteger(record.daysPerTray, `${path}.daysPerTray`),
    dailyWearGoalMinutes: requireIntegerInRange(
      record.dailyWearGoalMinutes,
      0,
      1440,
      `${path}.dailyWearGoalMinutes`,
    ),
    effectiveAt: requireSafeInteger(record.effectiveAt, `${path}.effectiveAt`),
    createdAt: requireSafeInteger(record.createdAt, `${path}.createdAt`),
  };
}

function validateTrayPeriod(value: unknown, path: string): BackupTrayPeriodV1 {
  const record = requireRecord(value, path);
  requireExactKeys(
    record,
    ['id', 'treatmentId', 'trayNumber', 'startedAt', 'endedAt'],
    path,
  );
  const startedAt = requireSafeInteger(record.startedAt, `${path}.startedAt`);
  const endedAt =
    record.endedAt === null
      ? null
      : requireSafeInteger(record.endedAt, `${path}.endedAt`);
  if (endedAt !== null && endedAt < startedAt) {
    validationError(`${path}.endedAt`, 'must not precede startedAt');
  }
  return {
    id: requirePositiveInteger(record.id, `${path}.id`),
    treatmentId: requirePositiveInteger(record.treatmentId, `${path}.treatmentId`),
    trayNumber: requirePositiveInteger(record.trayNumber, `${path}.trayNumber`),
    startedAt,
    endedAt,
  };
}

function validateWearPunch(value: unknown, path: string): BackupWearPunchV1 {
  const record = requireRecord(value, path);
  requireExactKeys(record, ['id', 'trayPeriodId', 'status', 'timestamp'], path);
  if (record.status !== 'IN' && record.status !== 'OUT') {
    validationError(`${path}.status`, "must be 'IN' or 'OUT'");
  }
  return {
    id: requirePositiveInteger(record.id, `${path}.id`),
    trayPeriodId: requirePositiveInteger(record.trayPeriodId, `${path}.trayPeriodId`),
    status: record.status,
    timestamp: requireSafeInteger(record.timestamp, `${path}.timestamp`),
  };
}

function validateNotificationSettings(
  value: unknown,
  path: string,
): BackupNotificationSettingsV1 {
  const record = requireRecord(value, path);
  requireExactKeys(
    record,
    [
      'outReminderEnabled',
      'outReminderMinutes',
      'outPersistentReminderIntervalMinutes',
      'trayChangeReminderEnabled',
      'trayChangeReminderHour',
      'trayChangeReminderMinute',
    ],
    path,
  );
  return {
    outReminderEnabled: requireBoolean(
      record.outReminderEnabled,
      `${path}.outReminderEnabled`,
    ),
    outReminderMinutes: requirePositiveInteger(
      record.outReminderMinutes,
      `${path}.outReminderMinutes`,
    ),
    outPersistentReminderIntervalMinutes: requireIntegerInRange(
      record.outPersistentReminderIntervalMinutes,
      5,
      240,
      `${path}.outPersistentReminderIntervalMinutes`,
    ),
    trayChangeReminderEnabled: requireBoolean(
      record.trayChangeReminderEnabled,
      `${path}.trayChangeReminderEnabled`,
    ),
    trayChangeReminderHour: requireIntegerInRange(
      record.trayChangeReminderHour,
      0,
      23,
      `${path}.trayChangeReminderHour`,
    ),
    trayChangeReminderMinute: requireIntegerInRange(
      record.trayChangeReminderMinute,
      0,
      59,
      `${path}.trayChangeReminderMinute`,
    ),
  };
}

export function validateBackupSnapshotEnvelope(
  value: unknown,
): BackupSnapshotEnvelopeV1 {
  const envelope = requireRecord(value, 'snapshot');
  requireExactKeys(envelope, ['schemaVersion', 'sourceAppVersion', 'payload'], 'snapshot');
  if (envelope.schemaVersion !== BACKUP_SNAPSHOT_SCHEMA_VERSION) {
    validationError(
      'snapshot.schemaVersion',
      `must equal ${BACKUP_SNAPSHOT_SCHEMA_VERSION}`,
    );
  }
  const sourceAppVersion = requireString(envelope.sourceAppVersion, 'snapshot.sourceAppVersion');
  if (sourceAppVersion.trim().length === 0) {
    validationError('snapshot.sourceAppVersion', 'must not be blank');
  }

  const rawPayload = requireRecord(envelope.payload, 'snapshot.payload');
  requireExactKeys(
    rawPayload,
    [
      'treatments',
      'treatmentPlanVersions',
      'trayPeriods',
      'wearPunches',
      'notificationSettings',
    ],
    'snapshot.payload',
  );
  const treatments = requireArray(rawPayload.treatments, 'snapshot.payload.treatments').map(
    (item, index) => validateTreatment(item, `snapshot.payload.treatments[${index}]`),
  );
  const treatmentPlanVersions = requireArray(
    rawPayload.treatmentPlanVersions,
    'snapshot.payload.treatmentPlanVersions',
  ).map((item, index) =>
    validateTreatmentPlanVersion(
      item,
      `snapshot.payload.treatmentPlanVersions[${index}]`,
    ),
  );
  const trayPeriods = requireArray(rawPayload.trayPeriods, 'snapshot.payload.trayPeriods').map(
    (item, index) => validateTrayPeriod(item, `snapshot.payload.trayPeriods[${index}]`),
  );
  const wearPunches = requireArray(rawPayload.wearPunches, 'snapshot.payload.wearPunches').map(
    (item, index) => validateWearPunch(item, `snapshot.payload.wearPunches[${index}]`),
  );
  const notificationSettings = validateNotificationSettings(
    rawPayload.notificationSettings,
    'snapshot.payload.notificationSettings',
  );

  requireUniqueIds(treatments, 'snapshot.payload.treatments');
  requireUniqueIds(treatmentPlanVersions, 'snapshot.payload.treatmentPlanVersions');
  requireUniqueIds(trayPeriods, 'snapshot.payload.trayPeriods');
  requireUniqueIds(wearPunches, 'snapshot.payload.wearPunches');

  const treatmentIds = new Set(treatments.map(({ id }) => id));
  for (const version of treatmentPlanVersions) {
    if (!treatmentIds.has(version.treatmentId)) {
      validationError(
        'snapshot.payload.treatmentPlanVersions',
        `references missing treatment ${version.treatmentId}`,
      );
    }
  }
  for (const period of trayPeriods) {
    if (!treatmentIds.has(period.treatmentId)) {
      validationError(
        'snapshot.payload.trayPeriods',
        `references missing treatment ${period.treatmentId}`,
      );
    }
  }
  const trayPeriodIds = new Set(trayPeriods.map(({ id }) => id));
  for (const punch of wearPunches) {
    if (!trayPeriodIds.has(punch.trayPeriodId)) {
      validationError(
        'snapshot.payload.wearPunches',
        `references missing tray period ${punch.trayPeriodId}`,
      );
    }
  }

  return {
    schemaVersion: BACKUP_SNAPSHOT_SCHEMA_VERSION,
    sourceAppVersion,
    payload: {
      treatments,
      treatmentPlanVersions,
      trayPeriods,
      wearPunches,
      notificationSettings,
    },
  };
}

function compareNumbers(left: number, right: number) {
  return left === right ? 0 : left < right ? -1 : 1;
}

export function canonicalizeBackupSnapshotPayloadV1(
  payload: BackupSnapshotPayloadV1,
): BackupSnapshotPayloadV1 {
  return {
    treatments: payload.treatments
      .map(({ id, createdAt }) => ({ id, createdAt }))
      .sort((left, right) => compareNumbers(left.id, right.id)),
    treatmentPlanVersions: payload.treatmentPlanVersions
      .map(
        ({
          id,
          treatmentId,
          totalTrays,
          daysPerTray,
          dailyWearGoalMinutes,
          effectiveAt,
          createdAt,
        }) => ({
          id,
          treatmentId,
          totalTrays,
          daysPerTray,
          dailyWearGoalMinutes,
          effectiveAt,
          createdAt,
        }),
      )
      .sort(
        (left, right) =>
          compareNumbers(left.treatmentId, right.treatmentId) ||
          compareNumbers(left.effectiveAt, right.effectiveAt) ||
          compareNumbers(left.id, right.id),
      ),
    trayPeriods: payload.trayPeriods
      .map(({ id, treatmentId, trayNumber, startedAt, endedAt }) => ({
        id,
        treatmentId,
        trayNumber,
        startedAt,
        endedAt,
      }))
      .sort(
        (left, right) =>
          compareNumbers(left.treatmentId, right.treatmentId) ||
          compareNumbers(left.startedAt, right.startedAt) ||
          compareNumbers(left.id, right.id),
      ),
    wearPunches: payload.wearPunches
      .map(({ id, trayPeriodId, status, timestamp }) => ({
        id,
        trayPeriodId,
        status,
        timestamp,
      }))
      .sort(
        (left, right) =>
          compareNumbers(left.trayPeriodId, right.trayPeriodId) ||
          compareNumbers(left.timestamp, right.timestamp) ||
          compareNumbers(left.id, right.id),
      ),
    notificationSettings: {
      outReminderEnabled: payload.notificationSettings.outReminderEnabled,
      outReminderMinutes: payload.notificationSettings.outReminderMinutes,
      outPersistentReminderIntervalMinutes:
        payload.notificationSettings.outPersistentReminderIntervalMinutes,
      trayChangeReminderEnabled: payload.notificationSettings.trayChangeReminderEnabled,
      trayChangeReminderHour: payload.notificationSettings.trayChangeReminderHour,
      trayChangeReminderMinute: payload.notificationSettings.trayChangeReminderMinute,
    },
  };
}

export function backupSnapshotUtf8ByteLength(value: string) {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    bytes += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }
  return bytes;
}

export function canonicalBackupSnapshotEnvelopeJson(envelope: BackupSnapshotEnvelopeV1) {
  return JSON.stringify({
    schemaVersion: envelope.schemaVersion,
    sourceAppVersion: envelope.sourceAppVersion,
    payload: canonicalizeBackupSnapshotPayloadV1(envelope.payload),
  });
}

export function canonicalBackupSnapshotContentJson(envelope: BackupSnapshotEnvelopeV1) {
  return JSON.stringify({
    schemaVersion: envelope.schemaVersion,
    payload: canonicalizeBackupSnapshotPayloadV1(envelope.payload),
  });
}

export async function computeBackupSnapshotContentHash(
  envelope: BackupSnapshotEnvelopeV1,
) {
  const contentHash = (
    await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      canonicalBackupSnapshotContentJson(envelope),
      { encoding: Crypto.CryptoEncoding.HEX },
    )
  ).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(contentHash)) {
    throw new BackupSnapshotValidationError('Snapshot content hash is invalid.');
  }
  return contentHash;
}

export async function serializeBackupSnapshot(
  db: SQLiteDatabase,
  input: { sourceAppVersion: string },
): Promise<SerializedBackupSnapshot> {
  let readPayload: BackupSnapshotPayloadV1 | null = null;

  await db.withExclusiveTransactionAsync(async (transaction) => {
    const treatments = await transaction.getAllAsync<TreatmentRow>(
      `SELECT id, created_at
       FROM treatments
       ORDER BY id`,
    );
    const treatmentPlanVersions = await transaction.getAllAsync<TreatmentPlanVersionRow>(
      `SELECT
         id,
         treatment_id,
         total_trays,
         days_per_tray,
         daily_wear_goal_minutes,
         effective_at,
         created_at
       FROM treatment_plan_versions
       ORDER BY treatment_id, effective_at, id`,
    );
    const trayPeriods = await transaction.getAllAsync<TrayPeriodRow>(
      `SELECT id, treatment_id, tray_number, started_at, ended_at
       FROM tray_periods
       ORDER BY treatment_id, started_at, id`,
    );
    const wearPunches = await transaction.getAllAsync<WearPunchRow>(
      `SELECT id, tray_period_id, status, timestamp
       FROM wear_punches
       ORDER BY tray_period_id, timestamp, id`,
    );
    const settings = await transaction.getFirstAsync<NotificationSettingsRow>(
      `SELECT
         out_reminder_enabled,
         out_reminder_minutes,
         out_persistent_reminder_interval_minutes,
         tray_change_reminder_enabled,
         tray_change_reminder_hour,
         tray_change_reminder_minute
       FROM settings
       WHERE id = 1`,
    );

    if (settings === null) {
      throw new BackupSnapshotValidationError('Snapshot notification settings are missing.');
    }

    readPayload = {
      treatments: treatments.map((row) => ({ id: row.id, createdAt: row.created_at })),
      treatmentPlanVersions: treatmentPlanVersions.map((row) => ({
        id: row.id,
        treatmentId: row.treatment_id,
        totalTrays: row.total_trays,
        daysPerTray: row.days_per_tray,
        dailyWearGoalMinutes: row.daily_wear_goal_minutes,
        effectiveAt: row.effective_at,
        createdAt: row.created_at,
      })),
      trayPeriods: trayPeriods.map((row) => ({
        id: row.id,
        treatmentId: row.treatment_id,
        trayNumber: row.tray_number,
        startedAt: row.started_at,
        endedAt: row.ended_at,
      })),
      wearPunches: wearPunches.map((row) => ({
        id: row.id,
        trayPeriodId: row.tray_period_id,
        status: row.status,
        timestamp: row.timestamp,
      })),
      notificationSettings: {
        outReminderEnabled: settings.out_reminder_enabled === 1,
        outReminderMinutes: settings.out_reminder_minutes,
        outPersistentReminderIntervalMinutes:
          settings.out_persistent_reminder_interval_minutes,
        trayChangeReminderEnabled: settings.tray_change_reminder_enabled === 1,
        trayChangeReminderHour: settings.tray_change_reminder_hour,
        trayChangeReminderMinute: settings.tray_change_reminder_minute,
      },
    };
  });

  if (readPayload === null) {
    throw new BackupSnapshotValidationError('Snapshot data could not be read.');
  }

  const envelope = validateBackupSnapshotEnvelope({
    schemaVersion: BACKUP_SNAPSHOT_SCHEMA_VERSION,
    sourceAppVersion: input.sourceAppVersion,
    payload: canonicalizeBackupSnapshotPayloadV1(readPayload),
  });
  const contentHash = await computeBackupSnapshotContentHash(envelope);

  const json = canonicalBackupSnapshotEnvelopeJson(envelope);
  return {
    json,
    schemaVersion: envelope.schemaVersion,
    sourceAppVersion: envelope.sourceAppVersion,
    contentHash,
    payloadBytes: backupSnapshotUtf8ByteLength(json),
  };
}
