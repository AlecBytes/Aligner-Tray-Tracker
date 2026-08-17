import type { SQLiteDatabase } from 'expo-sqlite';

import { DATABASE_VERSION, migrateDatabase } from '@/db/migrations';

describe('notification settings migration', () => {
  it('adds independent enabled flags and tray reminder time for version 1 databases', async () => {
    const execAsync = jest.fn(async () => undefined);
    const getFirstAsync = jest.fn(async () => ({ user_version: 1 }));
    const withTransactionAsync = jest.fn(async (task: () => Promise<void>) => task());
    const db = { execAsync, getFirstAsync, withTransactionAsync } as unknown as SQLiteDatabase;

    await migrateDatabase(db);

    expect(DATABASE_VERSION).toBe(2);
    expect(withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(execAsync).toHaveBeenCalledWith(
      expect.stringContaining('ADD COLUMN out_reminder_enabled'),
    );
    expect(execAsync).toHaveBeenCalledWith(
      expect.stringContaining('ADD COLUMN tray_change_reminder_enabled'),
    );
    expect(execAsync).toHaveBeenCalledWith(
      expect.stringContaining('ADD COLUMN tray_change_reminder_hour'),
    );
    expect(execAsync).toHaveBeenCalledWith(
      expect.stringContaining('ADD COLUMN tray_change_reminder_minute'),
    );
    expect(execAsync).toHaveBeenCalledWith('PRAGMA user_version = 2');
  });
});
