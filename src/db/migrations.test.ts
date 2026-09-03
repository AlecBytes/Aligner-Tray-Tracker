import type { SQLiteDatabase } from 'expo-sqlite';

import { DATABASE_VERSION, migrateDatabase } from '@/db/migrations';

describe('database migrations', () => {
  it('adds notification settings, installation metadata, and active-tray defense for version 1 databases', async () => {
    const execAsync = jest.fn(async () => undefined);
    const getFirstAsync = jest.fn(async () => ({ user_version: 1 }));
    const withTransactionAsync = jest.fn(async (task: () => Promise<void>) => task());
    const db = { execAsync, getFirstAsync, withTransactionAsync } as unknown as SQLiteDatabase;

    await migrateDatabase(db);

    expect(DATABASE_VERSION).toBe(5);
    expect(withTransactionAsync).toHaveBeenCalledTimes(4);
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
    expect(execAsync).toHaveBeenCalledWith(
      expect.stringContaining('ADD COLUMN out_persistent_reminder_interval_minutes'),
    );
    expect(execAsync).toHaveBeenCalledWith('PRAGMA user_version = 3');
    expect(execAsync).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE IF NOT EXISTS app_installation'),
    );
    expect(execAsync).toHaveBeenCalledWith('PRAGMA user_version = 4');
    expect(execAsync).toHaveBeenCalledWith(
      expect.stringContaining('CREATE UNIQUE INDEX IF NOT EXISTS tray_periods_one_active_per_treatment_idx'),
    );
    expect(execAsync).toHaveBeenCalledWith('PRAGMA user_version = 5');
  });

  it('adds the persistent interval, installation metadata, and active-tray defense for version 2 databases', async () => {
    const execAsync = jest.fn(async () => undefined);
    const getFirstAsync = jest.fn(async () => ({ user_version: 2 }));
    const withTransactionAsync = jest.fn(async (task: () => Promise<void>) => task());
    const db = { execAsync, getFirstAsync, withTransactionAsync } as unknown as SQLiteDatabase;

    await migrateDatabase(db);

    expect(withTransactionAsync).toHaveBeenCalledTimes(3);
    expect(execAsync).toHaveBeenCalledWith(
      expect.stringContaining('ADD COLUMN out_persistent_reminder_interval_minutes'),
    );
    expect(execAsync).toHaveBeenCalledWith('PRAGMA user_version = 3');
    expect(execAsync).toHaveBeenCalledWith(expect.stringContaining('randomblob(32)'));
    expect(execAsync).toHaveBeenCalledWith('PRAGMA user_version = 4');
    expect(execAsync).toHaveBeenCalledWith(
      expect.stringContaining('tray_periods_one_active_per_treatment_idx'),
    );
    expect(execAsync).toHaveBeenCalledWith('PRAGMA user_version = 5');
  });

  it('adds installation metadata and active-tray defense for version 3 databases', async () => {
    const execAsync = jest.fn(async () => undefined);
    const getFirstAsync = jest.fn(async () => ({ user_version: 3 }));
    const withTransactionAsync = jest.fn(async (task: () => Promise<void>) => task());
    const db = { execAsync, getFirstAsync, withTransactionAsync } as unknown as SQLiteDatabase;

    await migrateDatabase(db);

    expect(withTransactionAsync).toHaveBeenCalledTimes(2);
    expect(execAsync).toHaveBeenCalledWith(expect.stringContaining('app_installation'));
    expect(execAsync).toHaveBeenCalledWith('PRAGMA user_version = 4');
    expect(execAsync).toHaveBeenCalledWith(
      expect.stringContaining('WHERE ended_at IS NULL'),
    );
    expect(execAsync).toHaveBeenCalledWith('PRAGMA user_version = 5');
  });

  it('adds only the partial unique active-tray index for version 4 databases', async () => {
    const execAsync = jest.fn(async () => undefined);
    const getFirstAsync = jest.fn(async () => ({ user_version: 4 }));
    const withTransactionAsync = jest.fn(async (task: () => Promise<void>) => task());
    const db = { execAsync, getFirstAsync, withTransactionAsync } as unknown as SQLiteDatabase;

    await migrateDatabase(db);

    expect(withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(execAsync).toHaveBeenCalledWith(
      expect.stringContaining('CREATE UNIQUE INDEX IF NOT EXISTS tray_periods_one_active_per_treatment_idx'),
    );
    expect(execAsync).toHaveBeenCalledWith(expect.stringContaining('ON tray_periods (treatment_id)'));
    expect(execAsync).toHaveBeenCalledWith(expect.stringContaining('WHERE ended_at IS NULL'));
    expect(execAsync).toHaveBeenCalledWith('PRAGMA user_version = 5');
  });
});
