import type { SQLiteDatabase } from 'expo-sqlite';

import {
  DATABASE_VERSION,
  DatabaseIntegrityError,
  migrateDatabase,
} from '@/db/migrations';

function createDatabaseMock(
  userVersion: number,
  duplicateActiveTrayPeriods: { active_period_count: number; treatment_id: number } | null = null,
) {
  const execAsync = jest.fn(async () => undefined);
  const getFirstAsync = jest.fn(async (sql: string) => {
    if (sql === 'PRAGMA user_version') {
      return { user_version: userVersion };
    }

    if (sql.includes('HAVING COUNT(*) > 1')) {
      return duplicateActiveTrayPeriods;
    }

    throw new Error(`Unexpected migration query: ${sql}`);
  });
  const withTransactionAsync = jest.fn(async (task: () => Promise<void>) => task());
  const db = { execAsync, getFirstAsync, withTransactionAsync } as unknown as SQLiteDatabase;

  return { db, execAsync, getFirstAsync, withTransactionAsync };
}

describe('database migrations', () => {
  it('adds notification settings, installation metadata, and active-tray defense for version 1 databases', async () => {
    const { db, execAsync, withTransactionAsync } = createDatabaseMock(1);

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
    const { db, execAsync, withTransactionAsync } = createDatabaseMock(2);

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
    const { db, execAsync, withTransactionAsync } = createDatabaseMock(3);

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
    const { db, execAsync, getFirstAsync, withTransactionAsync } = createDatabaseMock(4);

    await migrateDatabase(db);

    expect(withTransactionAsync).toHaveBeenCalledTimes(1);
    expect(execAsync).toHaveBeenCalledWith(
      expect.stringContaining('CREATE UNIQUE INDEX IF NOT EXISTS tray_periods_one_active_per_treatment_idx'),
    );
    expect(execAsync).toHaveBeenCalledWith(expect.stringContaining('ON tray_periods (treatment_id)'));
    expect(execAsync).toHaveBeenCalledWith(expect.stringContaining('WHERE ended_at IS NULL'));
    expect(execAsync).toHaveBeenCalledWith('PRAGMA user_version = 5');
    expect(getFirstAsync).toHaveBeenCalledWith(expect.stringContaining('HAVING COUNT(*) > 1'));
  });

  it('stops a version 4 upgrade when a treatment already has multiple active trays', async () => {
    const { db, execAsync } = createDatabaseMock(4, {
      active_period_count: 2,
      treatment_id: 17,
    });

    await expect(migrateDatabase(db)).rejects.toEqual(
      new DatabaseIntegrityError(
        'Cannot upgrade the local database because treatment 17 has 2 active tray periods.',
      ),
    );

    expect(execAsync).not.toHaveBeenCalledWith(
      expect.stringContaining('tray_periods_one_active_per_treatment_idx'),
    );
    expect(execAsync).not.toHaveBeenCalledWith('PRAGMA user_version = 5');
  });
});
