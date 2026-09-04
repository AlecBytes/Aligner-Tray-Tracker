import type { SQLiteDatabase } from 'expo-sqlite';

import { withUserMutationTransaction } from '@/db/mutation-transaction';

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

describe('withUserMutationTransaction', () => {
  it('keeps root reads outside a failed exclusive transaction', async () => {
    let committedValue = 'before';
    let notifyWriteStarted!: () => void;
    const writeStarted = new Promise<void>((resolve) => {
      notifyWriteStarted = resolve;
    });
    let releaseOperation!: () => void;
    const operationReleased = new Promise<void>((resolve) => {
      releaseOperation = resolve;
    });

    const getFirstAsync = jest.fn(async () => ({ value: committedValue }));
    const withExclusiveTransactionAsync = jest.fn(
      async (task: (transaction: SQLiteDatabase) => Promise<void>) => {
        let stagedValue = committedValue;
        const transaction = {
          runAsync: jest.fn(async (_sql: string, value: string) => {
            stagedValue = value;
            return { changes: 1, lastInsertRowId: 0 };
          }),
        } as unknown as SQLiteDatabase;

        await task(transaction);
        committedValue = stagedValue;
      },
    );
    const db = {
      getFirstAsync,
      withExclusiveTransactionAsync,
    } as unknown as SQLiteDatabase;

    const operation = withUserMutationTransaction(db, async (transaction) => {
      await transaction.runAsync('UPDATE state SET value = ?', 'during');
      notifyWriteStarted();
      await operationReleased;
      throw new Error('Simulated operation failure.');
    });

    await writeStarted;
    await expect(db.getFirstAsync<{ value: string }>('SELECT value FROM state')).resolves.toEqual({
      value: 'before',
    });

    releaseOperation();
    await expect(operation).rejects.toThrow('Simulated operation failure.');

    expect(committedValue).toBe('before');
    expect(withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
    expect(getFirstAsync).toHaveBeenCalledTimes(1);
  });
});
