import type { SQLiteDatabase } from 'expo-sqlite';

import { serializeBackupSnapshot } from '@/features/cloud-backup/backup-snapshot';
import { getCloudAuthClient } from '@/features/cloud-auth/supabase-client.ios';
import {
  loadLatestCompletedBackup,
  performManualBackup,
} from '@/features/cloud-backup/manual-backup.ios';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.2.3' } },
}));
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
}));
jest.mock('@/features/cloud-backup/backup-snapshot', () => ({
  serializeBackupSnapshot: jest.fn(),
}));
jest.mock('@/features/cloud-auth/supabase-client.ios', () => ({
  getCloudAuthClient: jest.fn(),
}));

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SNAPSHOT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const COMPLETED_AT = '2026-08-23T04:15:00.000Z';
const JSON_ENVELOPE =
  '{"schemaVersion":1,"sourceAppVersion":"1.2.3","payload":{"treatments":[]}}';
const SNAPSHOT = {
  json: JSON_ENVELOPE,
  schemaVersion: 1 as const,
  sourceAppVersion: '1.2.3',
  contentHash: 'a'.repeat(64),
  payloadBytes: new TextEncoder().encode(JSON_ENVELOPE).byteLength,
};
const db = {} as SQLiteDatabase;

function successfulClient() {
  const findMaybeSingle = jest.fn(async () => ({ data: null, error: null }));
  const findLimit = jest.fn(() => ({ maybeSingle: findMaybeSingle }));
  const findEq = jest.fn(() => ({ limit: findLimit }));
  const findSelect = jest.fn(() => ({ eq: findEq }));

  const insertSingle = jest.fn(async () => ({
    data: { created_at: COMPLETED_AT },
    error: null,
  }));
  const insertSelect = jest.fn(() => ({ single: insertSingle }));
  const insert = jest.fn(() => ({ select: insertSelect }));
  const from = jest
    .fn()
    .mockReturnValueOnce({ select: findSelect })
    .mockReturnValueOnce({ insert });

  const upload = jest.fn(async () => ({ data: { path: 'ignored' }, error: null }));
  const storageFrom = jest.fn(() => ({ upload }));
  const getUser = jest.fn(async () => ({ data: { user: { id: USER_ID } }, error: null }));
  const signOut = jest.fn(async () => ({ error: null }));

  return {
    client: {
      auth: { getUser, signOut },
      from,
      storage: { from: storageFrom },
    },
    findSelect,
    findEq,
    upload,
    insert,
  };
}

describe('native manual backup service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(serializeBackupSnapshot).mockResolvedValue(SNAPSHOT);
  });

  it('derives the app version, verifies auth, uploads to the private bucket, and commits metadata', async () => {
    const service = successfulClient();
    jest.mocked(getCloudAuthClient).mockResolvedValue({
      status: 'configured',
      client: service.client as never,
    });

    await expect(performManualBackup(db)).resolves.toEqual({
      status: 'created',
      completedAt: COMPLETED_AT,
    });

    expect(service.client.auth.getUser).toHaveBeenCalledTimes(1);
    expect(serializeBackupSnapshot).toHaveBeenCalledWith(db, { sourceAppVersion: '1.2.3' });
    expect(service.findEq).toHaveBeenCalledWith('content_hash', SNAPSHOT.contentHash);
    expect(service.client.storage.from).toHaveBeenCalledWith('backup-snapshots');
    expect(service.upload).toHaveBeenCalledWith(
      `${USER_ID}/${SNAPSHOT_ID}.json`,
      expect.any(ArrayBuffer),
      { contentType: 'application/json', upsert: false },
    );
    expect(service.insert).toHaveBeenCalledWith({
      id: SNAPSHOT_ID,
      user_id: USER_ID,
      storage_path: `${USER_ID}/${SNAPSHOT_ID}.json`,
      schema_version: 1,
      app_version: '1.2.3',
      content_hash: SNAPSHOT.contentHash,
      payload_bytes: SNAPSHOT.payloadBytes,
    });
  });

  it('loads only the newest completed metadata visible through RLS', async () => {
    const maybeSingle = jest.fn(async () => ({
      data: { created_at: COMPLETED_AT },
      error: null,
    }));
    const limit = jest.fn(() => ({ maybeSingle }));
    const order = jest.fn(() => ({ limit }));
    const select = jest.fn(() => ({ order }));
    const from = jest.fn(() => ({ select }));
    const client = {
      auth: {
        getUser: jest.fn(async () => ({ data: { user: { id: USER_ID } }, error: null })),
        signOut: jest.fn(),
      },
      from,
    };
    jest.mocked(getCloudAuthClient).mockResolvedValue({
      status: 'configured',
      client: client as never,
    });

    await expect(loadLatestCompletedBackup(db)).resolves.toBe(COMPLETED_AT);
    expect(from).toHaveBeenCalledWith('backup_snapshots');
    expect(select).toHaveBeenCalledWith('created_at');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(limit).toHaveBeenCalledWith(1);
  });

  it('keeps a valid local session for connectivity failures', async () => {
    const signOut = jest.fn();
    jest.mocked(getCloudAuthClient).mockResolvedValue({
      status: 'configured',
      client: {
        auth: {
          getUser: jest.fn(async () => ({ data: { user: null }, error: new TypeError('fetch failed') })),
          signOut,
        },
      } as never,
    });

    await expect(performManualBackup(db)).resolves.toMatchObject({
      status: 'failure',
      kind: 'network',
    });
    expect(signOut).not.toHaveBeenCalled();
    expect(serializeBackupSnapshot).not.toHaveBeenCalled();
  });

  it('clears an invalid local session and requires sign in again', async () => {
    const signOut = jest.fn(async () => ({ error: null }));
    jest.mocked(getCloudAuthClient).mockResolvedValue({
      status: 'configured',
      client: {
        auth: {
          getUser: jest.fn(async () => ({ data: { user: null }, error: new Error('invalid JWT') })),
          signOut,
        },
      } as never,
    });

    await expect(performManualBackup(db)).resolves.toMatchObject({
      status: 'failure',
      kind: 'sessionExpired',
    });
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(serializeBackupSnapshot).not.toHaveBeenCalled();
  });
});
