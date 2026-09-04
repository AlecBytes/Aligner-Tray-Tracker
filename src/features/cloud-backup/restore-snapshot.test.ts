import {
  canonicalBackupSnapshotEnvelopeJson,
  computeBackupSnapshotContentHash,
  type BackupSnapshotEnvelopeV1,
} from '@/features/cloud-backup/backup-snapshot';
import {
  CloudRestoreOperationError,
  type RecoveryPoint,
} from '@/features/cloud-backup/cloud-restore-core';
import {
  validateDownloadedBackupSnapshot,
  validateRestorableBackupSnapshotV1,
} from '@/features/cloud-backup/restore-snapshot';

jest.mock('expo-crypto', () => {
  const nodeCrypto = jest.requireActual('crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    CryptoEncoding: { HEX: 'hex' },
    digestStringAsync: jest.fn(async (_algorithm: string, value: string) =>
      nodeCrypto.createHash('sha256').update(value).digest('hex'),
    ),
  };
});

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SNAPSHOT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function envelope(): BackupSnapshotEnvelopeV1 {
  return {
    schemaVersion: 1,
    sourceAppVersion: '1.0.0',
    payload: {
      treatments: [{ id: 7, createdAt: 100 }],
      treatmentPlanVersions: [
        {
          id: 11,
          treatmentId: 7,
          totalTrays: 20,
          daysPerTray: 10,
          dailyWearGoalMinutes: 1_320,
          effectiveAt: 100,
          createdAt: 100,
        },
      ],
      trayPeriods: [
        { id: 21, treatmentId: 7, trayNumber: 1, startedAt: 100, endedAt: 300 },
        { id: 22, treatmentId: 7, trayNumber: 2, startedAt: 300, endedAt: null },
      ],
      wearPunches: [
        { id: 31, trayPeriodId: 21, status: 'IN', timestamp: 100 },
        { id: 32, trayPeriodId: 21, status: 'OUT', timestamp: 200 },
        { id: 33, trayPeriodId: 22, status: 'OUT', timestamp: 300 },
        { id: 34, trayPeriodId: 22, status: 'IN', timestamp: 400 },
      ],
      notificationSettings: {
        outReminderEnabled: true,
        outReminderMinutes: 45,
        outPersistentReminderIntervalMinutes: 5,
        trayChangeReminderEnabled: true,
        trayChangeReminderHour: 9,
        trayChangeReminderMinute: 0,
      },
    },
  };
}

function encode(value: string) {
  const bytes = new TextEncoder().encode(value);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function recoveryPointFor(
  value: BackupSnapshotEnvelopeV1,
  text = canonicalBackupSnapshotEnvelopeJson(value),
): Promise<RecoveryPoint> {
  return {
    appVersion: value.sourceAppVersion,
    contentHash: await computeBackupSnapshotContentHash(value),
    createdAt: '2026-08-24T12:00:00.000Z',
    id: SNAPSHOT_ID,
    payloadBytes: encode(text).byteLength,
    schemaVersion: value.schemaVersion,
    storagePath: `${USER_ID}/${SNAPSHOT_ID}.json`,
    supported: true,
    userId: USER_ID,
  };
}

describe('downloaded restore snapshot validation', () => {
  it('accepts a canonical, matching, operational V1 snapshot', async () => {
    const value = envelope();
    const text = canonicalBackupSnapshotEnvelopeJson(value);
    await expect(
      validateDownloadedBackupSnapshot(encode(text), await recoveryPointFor(value, text)),
    ).resolves.toEqual(value);
  });

  it('rejects byte-length, app-version, checksum, and compatibility mismatches', async () => {
    const value = envelope();
    const text = canonicalBackupSnapshotEnvelopeJson(value);
    const point = await recoveryPointFor(value, text);
    await expect(
      validateDownloadedBackupSnapshot(encode(text), { ...point, payloadBytes: point.payloadBytes + 1 }),
    ).rejects.toMatchObject({ kind: 'invalidSnapshot' });
    await expect(
      validateDownloadedBackupSnapshot(encode(text), { ...point, appVersion: '2.0.0' }),
    ).rejects.toMatchObject({ kind: 'invalidSnapshot' });
    await expect(
      validateDownloadedBackupSnapshot(encode(text), { ...point, contentHash: 'b'.repeat(64) }),
    ).rejects.toMatchObject({ kind: 'invalidSnapshot' });
    await expect(
      validateDownloadedBackupSnapshot(encode(text), { ...point, supported: false, schemaVersion: 2 }),
    ).rejects.toMatchObject({ kind: 'incompatible' });
  });

  it('rejects malformed UTF-8, unknown properties, and noncanonical JSON', async () => {
    const value = envelope();
    const point = await recoveryPointFor(value);
    const invalidUtf8 = Uint8Array.from([0xc3, 0x28]).buffer;
    await expect(
      validateDownloadedBackupSnapshot(invalidUtf8, { ...point, payloadBytes: 2 }),
    ).rejects.toBeInstanceOf(CloudRestoreOperationError);

    const unknown = { ...value, unexpected: true };
    const unknownText = JSON.stringify(unknown);
    await expect(
      validateDownloadedBackupSnapshot(
        encode(unknownText),
        { ...point, payloadBytes: encode(unknownText).byteLength },
      ),
    ).rejects.toMatchObject({ kind: 'invalidSnapshot' });

    const pretty = JSON.stringify(value, null, 2);
    await expect(
      validateDownloadedBackupSnapshot(
        encode(pretty),
        { ...point, payloadBytes: encode(pretty).byteLength },
      ),
    ).rejects.toMatchObject({ kind: 'invalidSnapshot' });
  });

  it.each([
    ['no treatment', (value: BackupSnapshotEnvelopeV1) => (value.payload.treatments = [])],
    [
      'overlapping periods',
      (value: BackupSnapshotEnvelopeV1) => (value.payload.trayPeriods[0].endedAt = 350),
    ],
    [
      'active period before latest',
      (value: BackupSnapshotEnvelopeV1) => {
        value.payload.trayPeriods[0].endedAt = null;
        value.payload.trayPeriods[1].endedAt = 500;
      },
    ],
    [
      'period without anchor punch',
      (value: BackupSnapshotEnvelopeV1) => {
        value.payload.wearPunches = value.payload.wearPunches.filter(
          (punch) => punch.trayPeriodId !== 21,
        );
      },
    ],
    [
      'punch outside its period',
      (value: BackupSnapshotEnvelopeV1) => (value.payload.wearPunches[1].timestamp = 350),
    ],
    [
      'non-increasing punches',
      (value: BackupSnapshotEnvelopeV1) => (value.payload.wearPunches[1].timestamp = 100),
    ],
    [
      'non-alternating punches',
      (value: BackupSnapshotEnvelopeV1) => (value.payload.wearPunches[1].status = 'IN'),
    ],
    [
      'active tray beyond latest plan',
      (value: BackupSnapshotEnvelopeV1) => (value.payload.trayPeriods[1].trayNumber = 21),
    ],
  ])('rejects %s', (_label, mutate) => {
    const value = envelope();
    mutate(value);
    expect(() => validateRestorableBackupSnapshotV1(value)).toThrow(
      CloudRestoreOperationError,
    );
  });
});
