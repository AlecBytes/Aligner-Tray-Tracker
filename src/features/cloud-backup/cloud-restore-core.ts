import { BACKUP_SNAPSHOT_SCHEMA_VERSION } from '@/features/cloud-backup/backup-snapshot';

export const RECOVERY_POINT_PAGE_SIZE = 25;
export const MAX_BACKUP_SNAPSHOT_BYTES = 50 * 1024 * 1024;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TIMESTAMPTZ_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export type RecoveryPointCursor = {
  createdAt: string;
  id: string;
};

export type RecoveryPoint = {
  appVersion: string;
  contentHash: string;
  createdAt: string;
  id: string;
  payloadBytes: number;
  schemaVersion: number;
  storagePath: string;
  supported: boolean;
  userId: string;
};

export type RecoveryPointPage = {
  items: RecoveryPoint[];
  nextCursor: RecoveryPointCursor | null;
};

export type RecoveryPointMetadataRow = {
  app_version: unknown;
  content_hash: unknown;
  created_at: unknown;
  id: unknown;
  payload_bytes: unknown;
  schema_version: unknown;
  storage_path: unknown;
  user_id: unknown;
};

export type CloudRestoreFailureKind =
  | 'configuration'
  | 'sessionExpired'
  | 'network'
  | 'listing'
  | 'download'
  | 'incompatible'
  | 'invalidSnapshot'
  | 'notEmpty'
  | 'import';

export type CloudRestoreFailure = {
  status: 'failure';
  kind: CloudRestoreFailureKind;
  message: string;
  retryable: boolean;
};

export type CloudRestoreResult =
  | { status: 'restored'; reminders: 'reconciled' | 'needsAttention' }
  | CloudRestoreFailure;

const FAILURE_DETAILS: Record<
  CloudRestoreFailureKind,
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
  listing: {
    message: 'Your recovery points could not be loaded. Try again.',
    retryable: true,
  },
  download: {
    message: 'The selected backup could not be downloaded. Try again.',
    retryable: true,
  },
  incompatible: {
    message: 'Update Aligner Tracker to restore this backup.',
    retryable: false,
  },
  invalidSnapshot: {
    message: 'This backup is invalid or incomplete. Choose another recovery point.',
    retryable: false,
  },
  notEmpty: {
    message: 'Restore is available only on a new or empty installation.',
    retryable: false,
  },
  import: {
    message: 'The backup could not be restored. Your local data was not changed.',
    retryable: true,
  },
};

export class CloudRestoreOperationError extends Error {
  constructor(public readonly kind: CloudRestoreFailureKind) {
    super(FAILURE_DETAILS[kind].message);
    this.name = 'CloudRestoreOperationError';
  }
}

export function cloudRestoreFailure(
  error: unknown,
  fallbackKind: CloudRestoreFailureKind,
): CloudRestoreFailure {
  const kind = error instanceof CloudRestoreOperationError ? error.kind : fallbackKind;
  return { status: 'failure', kind, ...FAILURE_DETAILS[kind] };
}

function validTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    TIMESTAMPTZ_PATTERN.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function validateRecoveryPointCursor(value: RecoveryPointCursor) {
  if (!validTimestamp(value.createdAt) || !validUuid(value.id)) {
    throw new CloudRestoreOperationError('listing');
  }
  return value;
}

export function buildRecoveryPointCursorFilter(cursor: RecoveryPointCursor) {
  const validCursor = validateRecoveryPointCursor(cursor);
  const timestamp = `"${validCursor.createdAt}"`;
  return `created_at.lt.${timestamp},and(created_at.eq.${timestamp},id.lt.${validCursor.id})`;
}

export function validateRecoveryPointForUser(
  value: RecoveryPointMetadataRow,
  verifiedUserId: string,
): RecoveryPoint {
  if (!validUuid(verifiedUserId) || !validUuid(value.user_id) || value.user_id !== verifiedUserId) {
    throw new CloudRestoreOperationError('listing');
  }
  if (!validUuid(value.id)) throw new CloudRestoreOperationError('listing');
  if (!validTimestamp(value.created_at)) throw new CloudRestoreOperationError('listing');
  if (
    typeof value.schema_version !== 'number' ||
    !Number.isSafeInteger(value.schema_version) ||
    value.schema_version <= 0
  ) {
    throw new CloudRestoreOperationError('listing');
  }
  if (typeof value.app_version !== 'string' || value.app_version.trim().length === 0) {
    throw new CloudRestoreOperationError('listing');
  }
  if (typeof value.content_hash !== 'string' || !SHA256_PATTERN.test(value.content_hash)) {
    throw new CloudRestoreOperationError('listing');
  }
  if (
    typeof value.payload_bytes !== 'number' ||
    !Number.isSafeInteger(value.payload_bytes) ||
    value.payload_bytes <= 0 ||
    value.payload_bytes > MAX_BACKUP_SNAPSHOT_BYTES
  ) {
    throw new CloudRestoreOperationError('listing');
  }

  const expectedPath = `${verifiedUserId}/${value.id}.json`;
  if (value.storage_path !== expectedPath) {
    throw new CloudRestoreOperationError('listing');
  }

  return {
    appVersion: value.app_version,
    contentHash: value.content_hash,
    createdAt: value.created_at,
    id: value.id,
    payloadBytes: value.payload_bytes,
    schemaVersion: value.schema_version,
    storagePath: expectedPath,
    supported: value.schema_version === BACKUP_SNAPSHOT_SCHEMA_VERSION,
    userId: verifiedUserId,
  };
}

function compareRecoveryPoints(left: RecoveryPoint, right: RecoveryPoint) {
  const createdAtDifference = Date.parse(right.createdAt) - Date.parse(left.createdAt);
  if (createdAtDifference !== 0) return createdAtDifference;
  return right.id.localeCompare(left.id);
}

export function createRecoveryPointPage(
  rows: RecoveryPointMetadataRow[],
  verifiedUserId: string,
): RecoveryPointPage {
  if (rows.length > RECOVERY_POINT_PAGE_SIZE + 1) {
    throw new CloudRestoreOperationError('listing');
  }

  const points = rows.map((row) => validateRecoveryPointForUser(row, verifiedUserId));
  for (let index = 1; index < points.length; index += 1) {
    if (compareRecoveryPoints(points[index - 1], points[index]) > 0) {
      throw new CloudRestoreOperationError('listing');
    }
  }

  const items = points.slice(0, RECOVERY_POINT_PAGE_SIZE);
  const lastItem = items.at(-1);
  return {
    items,
    nextCursor:
      points.length > RECOVERY_POINT_PAGE_SIZE && lastItem
        ? { createdAt: lastItem.createdAt, id: lastItem.id }
        : null,
  };
}

export function selectDefaultRecoveryPointId(points: RecoveryPoint[]) {
  return points.find((point) => point.supported)?.id ?? null;
}
