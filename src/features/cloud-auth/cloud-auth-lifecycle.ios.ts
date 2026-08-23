import { AppState } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';

import { createCloudAuthLifecycle } from '@/features/cloud-auth/cloud-auth-lifecycle-core';
import { getCloudAuthClient } from '@/features/cloud-auth/supabase-client.ios';

let currentDatabase: SQLiteDatabase | null = null;

const lifecycle = createCloudAuthLifecycle({
  appState: AppState,
  getClient: async () => {
    if (!currentDatabase) return null;
    const result = await getCloudAuthClient(currentDatabase);
    return result.status === 'configured' ? result.client : null;
  },
});

export async function startCloudAuthLifecycle(db: SQLiteDatabase) {
  currentDatabase = db;
  return lifecycle.start();
}

export function stopCloudAuthLifecycle() {
  lifecycle.stop();
  currentDatabase = null;
}
