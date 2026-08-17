import { useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import {
  initializeLocalNotifications,
  reconcileLocalNotifications,
} from '@/features/notifications/local-notifications';

export function NotificationInitializer() {
  const db = useSQLiteContext();

  useEffect(() => {
    void initializeLocalNotifications(db);

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void reconcileLocalNotifications(db);
      }
    });

    return () => subscription.remove();
  }, [db]);

  return null;
}
