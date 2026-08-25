import type { SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { serializeBackupSnapshot } from '@/features/cloud-backup/backup-snapshot';
import {
  getConfiguredCloudBackupClient,
  getVerifiedCloudBackupUser,
  isCloudBackupAccessError,
  throwCloudBackupNetworkError,
} from '@/features/cloud-backup/cloud-backup-client.ios';
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

function networkOr(error: unknown) {
  try {
    throwCloudBackupNetworkError(error);
  } catch (nextError) {
    if (isCloudBackupAccessError(nextError) && nextError.kind === 'network') {
      throw new ManualBackupOperationError('network');
    }
    throw nextError;
  }
}

function sourceAppVersion() {
  return resolveSourceAppVersion(Constants.expoConfig?.version);
}

async function configuredClient(db: SQLiteDatabase) {
  try {
    return await getConfiguredCloudBackupClient(db);
  } catch (error) {
    if (isCloudBackupAccessError(error)) {
      throw new ManualBackupOperationError(error.kind);
    }
    throw error;
  }
}

async function getVerifiedUser(client: SupabaseClient) {
  try {
    return await getVerifiedCloudBackupUser(client);
  } catch (error) {
    if (isCloudBackupAccessError(error)) {
      throw new ManualBackupOperationError(error.kind);
    }
    throw error;
  }
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
