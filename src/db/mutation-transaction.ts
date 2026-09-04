import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

export type SQLiteMutationTransaction = Pick<
  SQLiteDatabase,
  'execAsync' | 'getAllAsync' | 'getFirstAsync' | 'runAsync'
>;

export async function withUserMutationTransaction(
  db: SQLiteDatabase,
  task: (transaction: SQLiteMutationTransaction) => Promise<void>,
) {
  if (Platform.OS === 'web') {
    await db.withTransactionAsync(async () => task(db));
    return;
  }

  await db.withExclusiveTransactionAsync(async (transaction) => {
    await task(transaction);
  });
}
