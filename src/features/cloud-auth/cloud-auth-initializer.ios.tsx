import { useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';

export function CloudAuthInitializer() {
  const db = useSQLiteContext();

  useEffect(() => {
    let mounted = true;
    let cleanup: (() => void) | undefined;

    void import('@/features/cloud-auth/cloud-auth-lifecycle.ios')
      .then(async (lifecycle) => {
        const nextCleanup = await lifecycle.startCloudAuthLifecycle(db);
        if (mounted) cleanup = nextCleanup;
        else nextCleanup();
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, [db]);

  return null;
}
