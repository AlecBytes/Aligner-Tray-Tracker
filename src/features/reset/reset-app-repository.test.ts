import type { SQLiteDatabase } from 'expo-sqlite';

import { resetAppData } from '@/features/reset/reset-app-repository';

describe('resetAppData', () => {
  it('deletes all user-created rows and restores default settings atomically', async () => {
    let insideTransaction = false;
    const execAsync = jest.fn(async (_sql: string) => {
      expect(insideTransaction).toBe(true);
    });
    const withTransactionAsync = jest.fn(async (task: () => Promise<void>) => {
      insideTransaction = true;

      try {
        await task();
      } finally {
        insideTransaction = false;
      }
    });
    const db = { execAsync, withTransactionAsync } as unknown as SQLiteDatabase;

    await resetAppData(db);

    expect(withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(execAsync).toHaveBeenCalledTimes(1);
    const sql = execAsync.mock.calls[0][0];
    expect(sql).toContain('DELETE FROM wear_punches');
    expect(sql).toContain('DELETE FROM tray_periods');
    expect(sql).toContain('DELETE FROM treatment_plan_versions');
    expect(sql).toContain('DELETE FROM treatments');
    expect(sql).toContain('DELETE FROM settings');
    expect(sql).toContain('INSERT INTO settings (id) VALUES (1)');
  });

  it('rejects when the reset transaction cannot complete', async () => {
    const error = new Error('write failed');
    const execAsync = jest.fn(async (_sql: string) => {
      throw error;
    });
    const withTransactionAsync = jest.fn(async (task: () => Promise<void>) => task());
    const db = { execAsync, withTransactionAsync } as unknown as SQLiteDatabase;

    await expect(resetAppData(db)).rejects.toBe(error);
  });
});
