import 'react-native-url-polyfill/auto';

import { createClient, processLock, type SupabaseClient } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getAppInstallationId } from '@/features/cloud-auth/app-installation';
import {
  getCloudAuthConfiguration,
  type CloudAuthConfiguration,
} from '@/features/cloud-auth/cloud-auth-config';
import { createSecureSessionStorage } from '@/features/cloud-auth/secure-session-storage';

type CloudAuthClientResult =
  | { status: 'configured'; client: SupabaseClient }
  | Extract<CloudAuthConfiguration, { status: 'unavailable' }>;

let clientPromise: Promise<CloudAuthClientResult> | null = null;
let activeStorage: ReturnType<typeof createSecureSessionStorage> | null = null;

async function createCloudAuthClient(db: SQLiteDatabase): Promise<CloudAuthClientResult> {
  const configuration = getCloudAuthConfiguration();
  if (configuration.status === 'unavailable') return configuration;
  if (!(await SecureStore.isAvailableAsync())) {
    return {
      status: 'unavailable',
      message: 'Secure account storage is unavailable on this device.',
    };
  }

  const installationId = await getAppInstallationId(db);
  activeStorage = createSecureSessionStorage(SecureStore, installationId, {
    createGeneration: Crypto.randomUUID,
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });

  return {
    status: 'configured',
    client: createClient(configuration.url, configuration.publishableKey, {
      auth: {
        storage: activeStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        lock: processLock,
      },
    }),
  };
}

export function getCloudAuthClient(db: SQLiteDatabase) {
  clientPromise ??= createCloudAuthClient(db).catch((error) => {
    clientPromise = null;
    throw error;
  });
  return clientPromise;
}

export async function clearPersistedCloudAuthSession(db: SQLiteDatabase) {
  const existingClient = clientPromise ? await clientPromise : null;
  if (existingClient?.status === 'configured') {
    existingClient.client.auth.stopAutoRefresh();
  }
  const installationId = await getAppInstallationId(db);
  const storage =
    activeStorage ??
    createSecureSessionStorage(SecureStore, installationId, {
      createGeneration: Crypto.randomUUID,
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });

  await storage.clear();
  activeStorage = null;
  clientPromise = null;
}
