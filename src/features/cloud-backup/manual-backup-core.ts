import type { SerializedBackupSnapshot } from '@/features/cloud-backup/backup-snapshot';

export const BACKUP_SNAPSHOTS_BUCKET = 'backup-snapshots';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TIMESTAMPTZ_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export type ManualBackupFailureKind =
  | 'configuration'
  | 'sessionExpired'
  | 'network'
  | 'serialization'
  | 'status'
  | 'storage'
  | 'metadata';

export type ManualBackupFailure = {
  status: 'failure';
  kind: ManualBackupFailureKind;
  message: string;
  retryable: boolean;
};

export type ManualBackupResult =
  | { status: 'created'; completedAt: string }
  | { status: 'current'; completedAt: string }
  | ManualBackupFailure;

export type CompletedBackup = {
  completedAt: string;
};

export type BackupMetadataInsert = {
  id: string;
  user_id: string;
  storage_path: string;
  schema_version: number;
  app_version: string;
  content_hash: string;
  payload_bytes: number;
};

export type BackupUpload = {
  path: string;
  body: ArrayBuffer;
  options: {
    contentType: 'application/json';
    upsert: false;
  };
};

export type ManualBackupDependencies = {
  getVerifiedUser: () => Promise<{ id: string }>;
  serialize: () => Promise<SerializedBackupSnapshot>;
  findCompletedByHash: (contentHash: string) => Promise<CompletedBackup | null>;
  createSnapshotId: () => string;
  uploadObject: (upload: BackupUpload) => Promise<void>;
  insertMetadata: (metadata: BackupMetadataInsert) => Promise<CompletedBackup>;
};

const FAILURE_DETAILS: Record<
  ManualBackupFailureKind,
  { message: string; retryable: boolean }
> = {
  configuration: {
    message: 'Cloud Backup is not configured in this app build.',
    retryable: false,
  },
  sessionExpired: {
    message: 'Your session has expired. Sign in with Apple again.',
    retryable: false,
  },
  network: {
    message: 'Cloud Backup could not be reached. Check your connection and try again.',
    retryable: true,
  },
  serialization: {
    message: 'The backup could not be prepared from your local data.',
    retryable: false,
  },
  status: {
    message: 'Your backup status could not be loaded. Try again.',
    retryable: true,
  },
  storage: {
    message: 'The backup could not be uploaded. Check your connection and try again.',
    retryable: true,
  },
  metadata: {
    message: 'The upload could not be completed. Try the backup again.',
    retryable: true,
  },
};

export class ManualBackupOperationError extends Error {
  constructor(public readonly kind: ManualBackupFailureKind) {
    super(FAILURE_DETAILS[kind].message);
    this.name = 'ManualBackupOperationError';
  }
}

export class DuplicateBackupMetadataError extends Error {
  constructor() {
    super('A completed backup with this content hash already exists.');
    this.name = 'DuplicateBackupMetadataError';
  }
}

export function manualBackupFailure(
  error: unknown,
  fallbackKind: ManualBackupFailureKind,
): ManualBackupFailure {
  const kind = error instanceof ManualBackupOperationError ? error.kind : fallbackKind;
  return { status: 'failure', kind, ...FAILURE_DETAILS[kind] };
}

export function resolveSourceAppVersion(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ManualBackupOperationError('configuration');
  }
  return value.trim();
}

export function validateCompletedAt(
  value: unknown,
  failureKind: ManualBackupFailureKind = 'status',
): string {
  if (
    typeof value !== 'string' ||
    !TIMESTAMPTZ_PATTERN.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new ManualBackupOperationError(failureKind);
  }
  return value;
}

function validateIdentifier(value: string, failureKind: ManualBackupFailureKind) {
  if (!UUID_PATTERN.test(value)) throw new ManualBackupOperationError(failureKind);
  return value;
}

function encodeSnapshot(snapshot: SerializedBackupSnapshot) {
  const bytes = new TextEncoder().encode(snapshot.json);
  if (bytes.byteLength !== snapshot.payloadBytes) {
    throw new ManualBackupOperationError('serialization');
  }

  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function completedResult(
  dependencies: ManualBackupDependencies,
  contentHash: string,
  fallbackKind: ManualBackupFailureKind,
): Promise<ManualBackupResult | null> {
  try {
    const completed = await dependencies.findCompletedByHash(contentHash);
    if (!completed) return null;
    return { status: 'current', completedAt: validateCompletedAt(completed.completedAt) };
  } catch (error) {
    return manualBackupFailure(error, fallbackKind);
  }
}

export async function executeManualBackup(
  dependencies: ManualBackupDependencies,
): Promise<ManualBackupResult> {
  let userId: string;
  try {
    const user = await dependencies.getVerifiedUser();
    userId = validateIdentifier(user.id, 'sessionExpired');
  } catch (error) {
    return manualBackupFailure(error, 'sessionExpired');
  }

  let snapshot: SerializedBackupSnapshot;
  let body: ArrayBuffer;
  try {
    snapshot = await dependencies.serialize();
    body = encodeSnapshot(snapshot);
  } catch (error) {
    return manualBackupFailure(error, 'serialization');
  }

  const existing = await completedResult(dependencies, snapshot.contentHash, 'status');
  if (existing) return existing;

  let snapshotId: string;
  try {
    snapshotId = validateIdentifier(dependencies.createSnapshotId(), 'serialization');
  } catch (error) {
    return manualBackupFailure(error, 'serialization');
  }

  const storagePath = `${userId}/${snapshotId}.json`;
  try {
    await dependencies.uploadObject({
      path: storagePath,
      body,
      options: { contentType: 'application/json', upsert: false },
    });
  } catch (error) {
    return manualBackupFailure(error, 'storage');
  }

  try {
    const completed = await dependencies.insertMetadata({
      id: snapshotId,
      user_id: userId,
      storage_path: storagePath,
      schema_version: snapshot.schemaVersion,
      app_version: snapshot.sourceAppVersion,
      content_hash: snapshot.contentHash,
      payload_bytes: snapshot.payloadBytes,
    });
    return {
      status: 'created',
      completedAt: validateCompletedAt(completed.completedAt, 'metadata'),
    };
  } catch (error) {
    if (error instanceof DuplicateBackupMetadataError) {
      const concurrent = await completedResult(dependencies, snapshot.contentHash, 'metadata');
      if (concurrent) return concurrent;
    }
    return manualBackupFailure(error, 'metadata');
  }
}
