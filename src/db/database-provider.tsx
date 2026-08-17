import { SQLiteProvider } from 'expo-sqlite';
import { Suspense, type PropsWithChildren, type ReactNode } from 'react';

import { migrateDatabase } from '@/db/migrations';

const DATABASE_NAME = 'aligner-tracker.db';

type AppDatabaseProviderProps = PropsWithChildren<{
  fallback: ReactNode;
}>;

export function AppDatabaseProvider({ children, fallback }: AppDatabaseProviderProps) {
  return (
    <Suspense fallback={fallback}>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDatabase} useSuspense>
        {children}
      </SQLiteProvider>
    </Suspense>
  );
}
