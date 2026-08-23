import type { SerializedBackupSnapshot } from '@/features/cloud-backup/backup-snapshot';
import {
  DuplicateBackupMetadataError,
  executeManualBackup,
  ManualBackupOperationError,
  resolveSourceAppVersion,
  type ManualBackupDependencies,
} from '@/features/cloud-backup/manual-backup-core';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const FIRST_SNAPSHOT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SECOND_SNAPSHOT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const COMPLETED_AT = '2026-08-23T04:15:00.123Z';
const CONTENT_HASH = 'a'.repeat(64);
const JSON_ENVELOPE =
  '{"schemaVersion":1,"sourceAppVersion":"1.2.3","payload":{"treatments":[]}}';

const SNAPSHOT: SerializedBackupSnapshot = {
  json: JSON_ENVELOPE,
  schemaVersion: 1,
  sourceAppVersion: '1.2.3',
  contentHash: CONTENT_HASH,
  payloadBytes: new TextEncoder().encode(JSON_ENVELOPE).byteLength,
};

function dependencies(
  overrides: Partial<ManualBackupDependencies> = {},
): ManualBackupDependencies {
  return {
    getVerifiedUser: jest.fn(async () => ({ id: USER_ID })),
    serialize: jest.fn(async () => SNAPSHOT),
    findCompletedByHash: jest.fn(async () => null),
    createSnapshotId: jest.fn(() => FIRST_SNAPSHOT_ID),
    uploadObject: jest.fn(async () => undefined),
    insertMetadata: jest.fn(async () => ({ completedAt: COMPLETED_AT })),
    ...overrides,
  };
}

describe('manual backup orchestration', () => {
  it('requires a nonblank Expo source app version', () => {
    expect(resolveSourceAppVersion(' 1.2.3 ')).toBe('1.2.3');
    expect(() => resolveSourceAppVersion('   ')).toThrow(
      expect.objectContaining({ kind: 'configuration' }),
    );
    expect(() => resolveSourceAppVersion(undefined)).toThrow(
      expect.objectContaining({ kind: 'configuration' }),
    );
  });

  it('uploads immutable JSON and commits exactly the Phase 2A metadata', async () => {
    const service = dependencies();

    await expect(executeManualBackup(service)).resolves.toEqual({
      status: 'created',
      completedAt: COMPLETED_AT,
    });

    expect(service.getVerifiedUser).toHaveBeenCalledTimes(1);
    expect(service.findCompletedByHash).toHaveBeenCalledWith(CONTENT_HASH);
    expect(service.uploadObject).toHaveBeenCalledTimes(1);
    const upload = jest.mocked(service.uploadObject).mock.calls[0][0];
    expect(upload.path).toBe(`${USER_ID}/${FIRST_SNAPSHOT_ID}.json`);
    expect(upload.options).toEqual({ contentType: 'application/json', upsert: false });
    expect(new TextDecoder().decode(upload.body)).toBe(JSON_ENVELOPE);
    expect(service.insertMetadata).toHaveBeenCalledWith({
      id: FIRST_SNAPSHOT_ID,
      user_id: USER_ID,
      storage_path: `${USER_ID}/${FIRST_SNAPSHOT_ID}.json`,
      schema_version: 1,
      app_version: '1.2.3',
      content_hash: CONTENT_HASH,
      payload_bytes: SNAPSHOT.payloadBytes,
    });
    expect(jest.mocked(service.insertMetadata).mock.calls[0][0]).not.toHaveProperty('created_at');
  });

  it('returns the server completion time without uploading when the content is current', async () => {
    const service = dependencies({
      findCompletedByHash: jest.fn(async () => ({ completedAt: COMPLETED_AT })),
    });

    await expect(executeManualBackup(service)).resolves.toEqual({
      status: 'current',
      completedAt: COMPLETED_AT,
    });
    expect(service.createSnapshotId).not.toHaveBeenCalled();
    expect(service.uploadObject).not.toHaveBeenCalled();
    expect(service.insertMetadata).not.toHaveBeenCalled();
  });

  it.each([
    ['sessionExpired', new ManualBackupOperationError('sessionExpired')],
    ['network', new ManualBackupOperationError('network')],
  ] as const)('stops before serialization for a %s authentication failure', async (kind, error) => {
    const service = dependencies({
      getVerifiedUser: jest.fn(async () => {
        throw error;
      }),
    });

    await expect(executeManualBackup(service)).resolves.toMatchObject({ status: 'failure', kind });
    expect(service.serialize).not.toHaveBeenCalled();
    expect(service.uploadObject).not.toHaveBeenCalled();
  });

  it('rejects a malformed authenticated user ID before constructing a path', async () => {
    const service = dependencies({ getVerifiedUser: jest.fn(async () => ({ id: '../other-user' })) });

    await expect(executeManualBackup(service)).resolves.toMatchObject({
      status: 'failure',
      kind: 'sessionExpired',
    });
    expect(service.serialize).not.toHaveBeenCalled();
  });

  it('reports serialization errors and byte-count mismatches before any cloud write', async () => {
    const malformed = { ...SNAPSHOT, payloadBytes: SNAPSHOT.payloadBytes + 1 };
    const service = dependencies({ serialize: jest.fn(async () => malformed) });

    await expect(executeManualBackup(service)).resolves.toMatchObject({
      status: 'failure',
      kind: 'serialization',
    });
    expect(service.findCompletedByHash).not.toHaveBeenCalled();
    expect(service.uploadObject).not.toHaveBeenCalled();
  });

  it('distinguishes status, Storage, and metadata failures without claiming completion', async () => {
    const statusFailure = dependencies({
      findCompletedByHash: jest.fn(async () => {
        throw new Error('query failed');
      }),
    });
    await expect(executeManualBackup(statusFailure)).resolves.toMatchObject({
      status: 'failure',
      kind: 'status',
    });
    expect(statusFailure.uploadObject).not.toHaveBeenCalled();

    const storageFailure = dependencies({
      uploadObject: jest.fn(async () => {
        throw new Error('upload failed');
      }),
    });
    await expect(executeManualBackup(storageFailure)).resolves.toMatchObject({
      status: 'failure',
      kind: 'storage',
    });
    expect(storageFailure.insertMetadata).not.toHaveBeenCalled();

    const metadataFailure = dependencies({
      insertMetadata: jest.fn(async () => {
        throw new Error('insert failed');
      }),
    });
    await expect(executeManualBackup(metadataFailure)).resolves.toMatchObject({
      status: 'failure',
      kind: 'metadata',
    });
    expect(metadataFailure.uploadObject).toHaveBeenCalledTimes(1);
  });

  it('does not accept a malformed server timestamp as success', async () => {
    const service = dependencies({
      insertMetadata: jest.fn(async () => ({ completedAt: 'not-a-timestamp' })),
    });

    await expect(executeManualBackup(service)).resolves.toMatchObject({
      status: 'failure',
      kind: 'metadata',
    });
  });

  it('resolves a concurrent duplicate metadata commit to the existing recovery point', async () => {
    const findCompletedByHash = jest
      .fn<ReturnType<ManualBackupDependencies['findCompletedByHash']>, [string]>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ completedAt: COMPLETED_AT });
    const service = dependencies({
      findCompletedByHash,
      insertMetadata: jest.fn(async () => {
        throw new DuplicateBackupMetadataError();
      }),
    });

    await expect(executeManualBackup(service)).resolves.toEqual({
      status: 'current',
      completedAt: COMPLETED_AT,
    });
    expect(service.uploadObject).toHaveBeenCalledTimes(1);
    expect(findCompletedByHash).toHaveBeenCalledTimes(2);
  });

  it('does not claim success when a duplicate response has no readable completed row', async () => {
    const service = dependencies({
      insertMetadata: jest.fn(async () => {
        throw new DuplicateBackupMetadataError();
      }),
    });

    await expect(executeManualBackup(service)).resolves.toMatchObject({
      status: 'failure',
      kind: 'metadata',
    });
  });

  it('retries an incomplete upload with a new ID and creates only the successful metadata row', async () => {
    const createSnapshotId = jest
      .fn<ReturnType<ManualBackupDependencies['createSnapshotId']>, []>()
      .mockReturnValueOnce(FIRST_SNAPSHOT_ID)
      .mockReturnValueOnce(SECOND_SNAPSHOT_ID);
    const insertMetadata = jest
      .fn<ReturnType<ManualBackupDependencies['insertMetadata']>, [Parameters<ManualBackupDependencies['insertMetadata']>[0]]>()
      .mockRejectedValueOnce(new Error('metadata unavailable'))
      .mockResolvedValueOnce({ completedAt: COMPLETED_AT });
    const service = dependencies({ createSnapshotId, insertMetadata });

    await expect(executeManualBackup(service)).resolves.toMatchObject({
      status: 'failure',
      kind: 'metadata',
    });
    await expect(executeManualBackup(service)).resolves.toEqual({
      status: 'created',
      completedAt: COMPLETED_AT,
    });

    expect(service.uploadObject).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ path: `${USER_ID}/${FIRST_SNAPSHOT_ID}.json` }),
    );
    expect(service.uploadObject).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ path: `${USER_ID}/${SECOND_SNAPSHOT_ID}.json` }),
    );
    expect(insertMetadata).toHaveBeenCalledTimes(2);
  });
});
