import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

export type SQLiteMutationTransaction = Pick<
  SQLiteDatabase,
  'execAsync' | 'getAllAsync' | 'getFirstAsync' | 'runAsync'
>;

export async function withUserMutationTransaction<T>(
  db: SQLiteDatabase,
  task: (transaction: SQLiteMutationTransaction) => Promise<T>,
) {
  let result!: T;
  if (Platform.OS === 'web') {
    await db.withTransactionAsync(async () => { result = await task(db); });
    return result;
  }

  await db.withExclusiveTransactionAsync(async (transaction) => {
    result = await task(transaction);
  });
  return result;
}
