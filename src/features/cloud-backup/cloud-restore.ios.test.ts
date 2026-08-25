import type { SQLiteDatabase } from 'expo-sqlite';

import type { BackupSnapshotEnvelopeV1 } from '@/features/cloud-backup/backup-snapshot';
import {
  getConfiguredCloudBackupClient,
  getVerifiedCloudBackupUser,
  throwCloudBackupNetworkError,
} from '@/features/cloud-backup/cloud-backup-client.ios';
import {
  listRecoveryPoints,
  restoreRecoveryPoint,
  type RecoveryPoint,
} from '@/features/cloud-backup/cloud-restore.ios';
import {
  importBackupSnapshot,
  isCloudRestoreEligible,
} from '@/features/cloud-backup/restore-repository';
import { validateDownloadedBackupSnapshot } from '@/features/cloud-backup/restore-snapshot';
import { reconcileLocalNotifications } from '@/features/notifications/local-notifications';

jest.mock('@/features/cloud-backup/cloud-backup-client.ios', () => {
  const actual = jest.requireActual('@/features/cloud-backup/cloud-backup-client.ios');
  return {
    ...actual,
    getConfiguredCloudBackupClient: jest.fn(),
    getVerifiedCloudBackupUser: jest.fn(),
    throwCloudBackupNetworkError: jest.fn(),
  };
});
jest.mock('@/features/cloud-backup/restore-repository');
jest.mock('@/features/cloud-backup/restore-snapshot');
jest.mock('@/features/notifications/local-notifications');

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SNAPSHOT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CREATED_AT = '2026-08-24T12:00:00.000Z';
const db = {} as SQLiteDatabase;

const recoveryPoint: RecoveryPoint = {
  appVersion: '1.0.0',
  contentHash: 'a'.repeat(64),
  createdAt: CREATED_AT,
  id: SNAPSHOT_ID,
  payloadBytes: 4,
  schemaVersion: 1,
  storagePath: `${USER_ID}/${SNAPSHOT_ID}.json`,
  supported: true,
  userId: USER_ID,
};

const metadataRow = {
  app_version: recoveryPoint.appVersion,
  content_hash: recoveryPoint.contentHash,
  created_at: recoveryPoint.createdAt,
  id: recoveryPoint.id,
  payload_bytes: recoveryPoint.payloadBytes,
  schema_version: recoveryPoint.schemaVersion,
  storage_path: recoveryPoint.storagePath,
  user_id: recoveryPoint.userId,
};

function listClient(rows = [metadataRow]) {
  const query = {
    eq: jest.fn(),
    limit: jest.fn(async () => ({ data: rows, error: null })),
    or: jest.fn(),
    order: jest.fn(),
    select: jest.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.or.mockReturnValue(query);
  return {
    client: { from: jest.fn(() => query) },
    query,
  };
}

function restoreClient() {
  const arrayBuffer = jest.fn(async () => new TextEncoder().encode('data').buffer);
  const download = jest.fn(async () => ({ data: { arrayBuffer }, error: null }));
  const storageFrom = jest.fn(() => ({ download }));
  return { arrayBuffer, client: { storage: { from: storageFrom } }, download, storageFrom };
}

describe('native cloud restore service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getVerifiedCloudBackupUser).mockResolvedValue({ id: USER_ID });
    jest.mocked(isCloudRestoreEligible).mockResolvedValue(true);
    jest.mocked(importBackupSnapshot).mockResolvedValue({} as never);
    jest.mocked(reconcileLocalNotifications).mockResolvedValue();
    jest.mocked(validateDownloadedBackupSnapshot).mockResolvedValue(
      {} as BackupSnapshotEnvelopeV1,
    );
    jest.mocked(throwCloudBackupNetworkError).mockImplementation((error) => {
      throw error;
    });
  });

  it('lists an owned page through stable RLS-scoped ordering', async () => {
    const service = listClient();
    jest.mocked(getConfiguredCloudBackupClient).mockResolvedValue(service.client as never);

    await expect(listRecoveryPoints(db)).resolves.toEqual({
      items: [recoveryPoint],
      nextCursor: null,
    });
    expect(service.client.from).toHaveBeenCalledWith('backup_snapshots');
    expect(service.query.select).toHaveBeenCalledWith(
      'id,user_id,storage_path,schema_version,app_version,content_hash,payload_bytes,created_at',
    );
    expect(service.query.eq).toHaveBeenCalledWith('user_id', USER_ID);
    expect(service.query.order).toHaveBeenNthCalledWith(1, 'created_at', {
      ascending: false,
    });
    expect(service.query.order).toHaveBeenNthCalledWith(2, 'id', { ascending: false });
    expect(service.query.limit).toHaveBeenCalledWith(26);
  });

  it('applies the full keyset cursor when loading older backups', async () => {
    const service = listClient([]);
    jest.mocked(getConfiguredCloudBackupClient).mockResolvedValue(service.client as never);
    await listRecoveryPoints(db, { createdAt: CREATED_AT, id: SNAPSHOT_ID });
    expect(service.query.or).toHaveBeenCalledWith(
      `created_at.lt."${CREATED_AT}",and(created_at.eq."${CREATED_AT}",id.lt.${SNAPSHOT_ID})`,
    );
  });

  it('revalidates the user, privately downloads once, validates, imports, and reconciles', async () => {
    const service = restoreClient();
    jest.mocked(getConfiguredCloudBackupClient).mockResolvedValue(service.client as never);

    await expect(restoreRecoveryPoint(db, recoveryPoint)).resolves.toEqual({
      status: 'restored',
      reminders: 'reconciled',
    });
    expect(getVerifiedCloudBackupUser).toHaveBeenCalledTimes(1);
    expect(service.storageFrom).toHaveBeenCalledWith('backup-snapshots');
    expect(service.download).toHaveBeenCalledWith(recoveryPoint.storagePath, {}, { signal: undefined });
    expect(validateDownloadedBackupSnapshot).toHaveBeenCalledWith(
      expect.any(ArrayBuffer),
      recoveryPoint,
    );
    expect(importBackupSnapshot).toHaveBeenCalledWith(db, expect.anything());
    expect(reconcileLocalNotifications).toHaveBeenCalledWith(db);
  });

  it('keeps a successful restore when notification reconciliation fails', async () => {
    const service = restoreClient();
    jest.mocked(getConfiguredCloudBackupClient).mockResolvedValue(service.client as never);
    jest.mocked(reconcileLocalNotifications).mockRejectedValue(new Error('notifications'));
    await expect(restoreRecoveryPoint(db, recoveryPoint)).resolves.toEqual({
      status: 'restored',
      reminders: 'needsAttention',
    });
  });

  it('does not contact cloud services when local treatment data exists', async () => {
    jest.mocked(isCloudRestoreEligible).mockResolvedValue(false);
    await expect(restoreRecoveryPoint(db, recoveryPoint)).resolves.toMatchObject({
      status: 'failure',
      kind: 'notEmpty',
    });
    expect(getConfiguredCloudBackupClient).not.toHaveBeenCalled();
  });

  it('maps an expired verified session without attempting a download', async () => {
    const service = restoreClient();
    jest.mocked(getConfiguredCloudBackupClient).mockResolvedValue(service.client as never);
    jest
      .mocked(getVerifiedCloudBackupUser)
      .mockRejectedValue({ kind: 'sessionExpired' });
    await expect(restoreRecoveryPoint(db, recoveryPoint)).resolves.toMatchObject({
      status: 'failure',
      kind: 'sessionExpired',
    });
    expect(service.download).not.toHaveBeenCalled();
  });
});
