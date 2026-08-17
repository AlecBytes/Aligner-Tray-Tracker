import { useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';

import { initializeLocalNotifications } from '@/features/notifications/local-notifications';

export function NotificationInitializer() {
  const db = useSQLiteContext();

  useEffect(() => {
    void initializeLocalNotifications(db);
  }, [db]);

  return null;
}
