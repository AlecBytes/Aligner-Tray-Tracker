import {
  isAuthRetryableFetchError,
  type SupabaseClient,
} from '@supabase/supabase-js';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getCloudAuthClient } from '@/features/cloud-auth/supabase-client.ios';

export type CloudBackupAccessErrorKind =
  | 'configuration'
  | 'network'
  | 'sessionExpired';

export class CloudBackupAccessError extends Error {
  constructor(public readonly kind: CloudBackupAccessErrorKind) {
    super(kind);
    this.name = 'CloudBackupAccessError';
  }
}

export function isCloudBackupAccessError(error: unknown): error is CloudBackupAccessError {
  return (
    error instanceof CloudBackupAccessError ||
    (typeof error === 'object' &&
      error !== null &&
      'kind' in error &&
      (error.kind === 'configuration' ||
        error.kind === 'network' ||
        error.kind === 'sessionExpired'))
  );
}

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

export function isCloudBackupNetworkError(error: unknown): boolean {
  if (isAuthRetryableFetchError(error) || error instanceof TypeError) return true;

  const details = error as ErrorWithDetails | null;
  if (details?.originalError && details.originalError !== error) {
    return isCloudBackupNetworkError(details.originalError);
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

export function throwCloudBackupNetworkError(error: unknown): never {
  if (isCloudBackupNetworkError(error)) throw new CloudBackupAccessError('network');
  throw error;
}

export async function getConfiguredCloudBackupClient(db: SQLiteDatabase) {
  const result = await getCloudAuthClient(db);
  if (result.status === 'unavailable') {
    throw new CloudBackupAccessError('configuration');
  }
  return result.client;
}

async function clearExpiredSession(client: SupabaseClient) {
  try {
    await client.auth.signOut({ scope: 'local' });
  } catch {
    // The verified user lookup already rejected the session. The auth listener
    // and next screen load reconcile state even if explicit cleanup also fails.
  }
}

export async function getVerifiedCloudBackupUser(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser();
  if (error) {
    if (isCloudBackupNetworkError(error)) throw new CloudBackupAccessError('network');
    await clearExpiredSession(client);
    throw new CloudBackupAccessError('sessionExpired');
  }
  if (!data.user) {
    await clearExpiredSession(client);
    throw new CloudBackupAccessError('sessionExpired');
  }
  return { id: data.user.id };
}
