import type { SQLiteDatabase } from 'expo-sqlite';

import {
  getConfiguredCloudBackupClient,
  getVerifiedCloudBackupUser,
  isCloudBackupAccessError,
  throwCloudBackupNetworkError,
} from '@/features/cloud-backup/cloud-backup-client.ios';
import { BACKUP_SNAPSHOTS_BUCKET } from '@/features/cloud-backup/manual-backup-core';
import {
  buildRecoveryPointCursorFilter,
  cloudRestoreFailure,
  CloudRestoreOperationError,
  createRecoveryPointPage,
  RECOVERY_POINT_PAGE_SIZE,
  type CloudRestoreFailureKind,
  type CloudRestoreResult,
  type RecoveryPoint,
  type RecoveryPointCursor,
  type RecoveryPointMetadataRow,
  type RecoveryPointPage,
} from '@/features/cloud-backup/cloud-restore-core';
import {
  importBackupSnapshot,
  isCloudRestoreEligible,
} from '@/features/cloud-backup/restore-repository';
import { validateDownloadedBackupSnapshot } from '@/features/cloud-backup/restore-snapshot';
import { reconcileLocalNotifications } from '@/features/notifications/local-notifications';

export type {
  CloudRestoreResult,
  RecoveryPoint,
  RecoveryPointCursor,
  RecoveryPointPage,
} from '@/features/cloud-backup/cloud-restore-core';

const RECOVERY_POINT_COLUMNS =
  'id,user_id,storage_path,schema_version,app_version,content_hash,payload_bytes,created_at';

function mapAccessError(error: unknown): never {
  if (isCloudBackupAccessError(error)) {
    throw new CloudRestoreOperationError(error.kind);
  }
  throw error;
}

function networkOr(error: unknown, fallbackKind: CloudRestoreFailureKind): never {
  try {
    throwCloudBackupNetworkError(error);
  } catch (nextError) {
    if (isCloudBackupAccessError(nextError)) {
      throw new CloudRestoreOperationError(nextError.kind);
    }
    throw new CloudRestoreOperationError(fallbackKind);
  }
}

async function configuredClient(db: SQLiteDatabase) {
  try {
    return await getConfiguredCloudBackupClient(db);
  } catch (error) {
    return mapAccessError(error);
  }
}

async function verifiedUser(client: Parameters<typeof getVerifiedCloudBackupUser>[0]) {
  try {
    return await getVerifiedCloudBackupUser(client);
  } catch (error) {
    return mapAccessError(error);
  }
}

export async function listRecoveryPoints(
  db: SQLiteDatabase,
  cursor: RecoveryPointCursor | null = null,
): Promise<RecoveryPointPage> {
  try {
    const client = await configuredClient(db);
    const user = await verifiedUser(client);
    let query = client
      .from('backup_snapshots')
      .select(RECOVERY_POINT_COLUMNS)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });

    if (cursor) query = query.or(buildRecoveryPointCursorFilter(cursor));
    const { data, error } = await query.limit(RECOVERY_POINT_PAGE_SIZE + 1);
    if (error) networkOr(error, 'listing');
    return createRecoveryPointPage(
      (data ?? []) as unknown as RecoveryPointMetadataRow[],
      user.id,
    );
  } catch (error) {
    if (error instanceof CloudRestoreOperationError) throw error;
    throw new CloudRestoreOperationError('listing');
  }
}

export async function restoreRecoveryPoint(
  db: SQLiteDatabase,
  recoveryPoint: RecoveryPoint,
  options: { signal?: AbortSignal } = {},
): Promise<CloudRestoreResult> {
  try {
    if (!(await isCloudRestoreEligible(db))) {
      throw new CloudRestoreOperationError('notEmpty');
    }
    if (!recoveryPoint.supported) {
      throw new CloudRestoreOperationError('incompatible');
    }

    const client = await configuredClient(db);
    const user = await verifiedUser(client);
    if (
      recoveryPoint.userId !== user.id ||
      recoveryPoint.storagePath !== `${user.id}/${recoveryPoint.id}.json`
    ) {
      throw new CloudRestoreOperationError('invalidSnapshot');
    }

    const { data, error } = await client.storage
      .from(BACKUP_SNAPSHOTS_BUCKET)
      .download(recoveryPoint.storagePath, {}, { signal: options.signal });
    if (error) networkOr(error, 'download');
    if (!data) throw new CloudRestoreOperationError('download');

    let bytes: ArrayBuffer;
    try {
      bytes = await data.arrayBuffer();
    } catch {
      throw new CloudRestoreOperationError('download');
    }
    const envelope = await validateDownloadedBackupSnapshot(bytes, recoveryPoint);
    await importBackupSnapshot(db, envelope);

    try {
      await reconcileLocalNotifications(db);
      return { status: 'restored', reminders: 'reconciled' };
    } catch {
      return { status: 'restored', reminders: 'needsAttention' };
    }
  } catch (error) {
    if (isCloudBackupAccessError(error)) {
      return cloudRestoreFailure(
        new CloudRestoreOperationError(error.kind),
        'import',
      );
    }
    return cloudRestoreFailure(error, 'import');
  }
}
