import {
  isAuthRetryableFetchError,
  type SupabaseClient,
} from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getCloudAuthClient } from '@/features/cloud-auth/supabase-client.ios';
import { serializeBackupSnapshot } from '@/features/cloud-backup/backup-snapshot';
import {
  BACKUP_SNAPSHOTS_BUCKET,
  DuplicateBackupMetadataError,
  executeManualBackup,
  manualBackupFailure,
  ManualBackupOperationError,
  resolveSourceAppVersion,
  validateCompletedAt,
  type BackupMetadataInsert,
  type CompletedBackup,
  type ManualBackupResult,
} from '@/features/cloud-backup/manual-backup-core';

export type { ManualBackupResult } from '@/features/cloud-backup/manual-backup-core';

type ErrorWithDetails = {
  message?: unknown;
  name?: unknown;
  originalError?: unknown;
};

function errorText(error: unknown): string {
  if (error instanceof Error) return `${error.name} ${error.message}`.toLowerCase();
  if (typeof error === 'object' && error !== null) {
    const details = error as ErrorWithDetails;
    return `${String(details.name ?? '')} ${String(details.message ?? '')}`.toLowerCase();
  }
  return String(error).toLowerCase();
}

function isNetworkError(error: unknown): boolean {
  if (isAuthRetryableFetchError(error) || error instanceof TypeError) return true;

  const details = error as ErrorWithDetails | null;
  if (details?.originalError && details.originalError !== error) {
    return isNetworkError(details.originalError);
  }

  const text = errorText(error);
  return (
    text.includes('network request failed') ||
    text.includes('failed to fetch') ||
    text.includes('fetch failed') ||
    text.includes('networkerror') ||
    text.includes('timed out')
  );
}

function networkOr(error: unknown) {
  if (isNetworkError(error)) throw new ManualBackupOperationError('network');
  throw error;
}

function sourceAppVersion() {
  return resolveSourceAppVersion(Constants.expoConfig?.version);
}

async function configuredClient(db: SQLiteDatabase) {
  const result = await getCloudAuthClient(db);
  if (result.status === 'unavailable') {
    throw new ManualBackupOperationError('configuration');
  }
  return result.client;
}

async function clearExpiredSession(client: SupabaseClient) {
  try {
    await client.auth.signOut({ scope: 'local' });
  } catch {
    // getUser has already rejected the session. The auth listener and next load
    // will reconcile the screen even if explicit local cleanup also fails.
  }
}

async function getVerifiedUser(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser();
  if (error) {
    if (isNetworkError(error)) throw new ManualBackupOperationError('network');
    await clearExpiredSession(client);
    throw new ManualBackupOperationError('sessionExpired');
  }
  if (!data.user) {
    await clearExpiredSession(client);
    throw new ManualBackupOperationError('sessionExpired');
  }
  return { id: data.user.id };
}

async function findCompletedByHash(
  client: SupabaseClient,
  contentHash: string,
): Promise<CompletedBackup | null> {
  const { data, error } = await client
    .from('backup_snapshots')
    .select('created_at')
    .eq('content_hash', contentHash)
    .limit(1)
    .maybeSingle();

  if (error) networkOr(error);
  if (!data) return null;
  return { completedAt: data.created_at };
}

async function uploadObject(
  client: SupabaseClient,
  upload: Parameters<
    Parameters<typeof executeManualBackup>[0]['uploadObject']
  >[0],
) {
  const { error } = await client.storage
    .from(BACKUP_SNAPSHOTS_BUCKET)
    .upload(upload.path, upload.body, upload.options);
  if (error) networkOr(error);
}

async function insertMetadata(
  client: SupabaseClient,
  metadata: BackupMetadataInsert,
): Promise<CompletedBackup> {
  const { data, error } = await client
    .from('backup_snapshots')
    .insert(metadata)
    .select('created_at')
    .single();

  if (error) {
    if (error.code === '23505') throw new DuplicateBackupMetadataError();
    networkOr(error);
  }
  if (!data) throw new ManualBackupOperationError('metadata');
  return { completedAt: data.created_at };
}

export async function loadLatestCompletedBackup(db: SQLiteDatabase): Promise<string | null> {
  try {
    const client = await configuredClient(db);
    await getVerifiedUser(client);

    const { data, error } = await client
      .from('backup_snapshots')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) networkOr(error);
    return data ? validateCompletedAt(data.created_at) : null;
  } catch (error) {
    if (error instanceof ManualBackupOperationError) throw error;
    throw new ManualBackupOperationError('status');
  }
}

export async function performManualBackup(db: SQLiteDatabase): Promise<ManualBackupResult> {
  try {
    const appVersion = sourceAppVersion();
    const client = await configuredClient(db);

    return executeManualBackup({
      getVerifiedUser: () => getVerifiedUser(client),
      serialize: () => serializeBackupSnapshot(db, { sourceAppVersion: appVersion }),
      findCompletedByHash: (contentHash) => findCompletedByHash(client, contentHash),
      createSnapshotId: Crypto.randomUUID,
      uploadObject: (upload) => uploadObject(client, upload),
      insertMetadata: (metadata) => insertMetadata(client, metadata),
    });
  } catch (error) {
    return manualBackupFailure(error, 'configuration');
  }
}
