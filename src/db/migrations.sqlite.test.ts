import type { SQLiteDatabase } from 'expo-sqlite';

import { DatabaseIntegrityError, migrateDatabase } from '@/db/migrations';

type StatementSync = {
  get: (...parameters: unknown[]) => unknown;
  run: (...parameters: unknown[]) => unknown;
};

type NodeDatabaseSync = {
  close: () => void;
  exec: (sql: string) => void;
  prepare: (sql: string) => StatementSync;
};

const { DatabaseSync } = jest.requireActual('node:sqlite') as {
  DatabaseSync: new (path: string) => NodeDatabaseSync;
};

function createVersionFourDatabase() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE treatments (
      id INTEGER PRIMARY KEY NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE tray_periods (
      id INTEGER PRIMARY KEY NOT NULL,
      treatment_id INTEGER NOT NULL,
      tray_number INTEGER NOT NULL CHECK (tray_number > 0),
      started_at INTEGER NOT NULL,
      ended_at INTEGER CHECK (ended_at IS NULL OR ended_at >= started_at),
      FOREIGN KEY (treatment_id) REFERENCES treatments (id) ON DELETE CASCADE
    );

    INSERT INTO treatments (id, created_at) VALUES (1, 100), (2, 100);
    PRAGMA user_version = 4;
  `);

  const db = {
    execAsync: async (sql: string) => {
      sqlite.exec(sql);
    },
    getFirstAsync: async (sql: string, ...parameters: unknown[]) =>
      sqlite.prepare(sql).get(...parameters) ?? null,
    withTransactionAsync: async (task: () => Promise<void>) => {
      sqlite.exec('BEGIN');

      try {
        await task();
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  } as unknown as SQLiteDatabase;

  return { db, sqlite };
}

describe('active tray migration SQLite behavior', () => {
  it('allows historical periods while rejecting a second active period per treatment', async () => {
    const { db, sqlite } = createVersionFourDatabase();

    try {
      sqlite.exec(`
        INSERT INTO tray_periods (id, treatment_id, tray_number, started_at)
        VALUES (1, 1, 1, 100);

        INSERT INTO tray_periods (id, treatment_id, tray_number, started_at, ended_at)
        VALUES (2, 1, 1, 50, 99);
      `);

      await migrateDatabase(db);

      expect(sqlite.prepare('PRAGMA user_version').get()).toMatchObject({ user_version: 5 });
      expect(() =>
        sqlite.exec(`
          INSERT INTO tray_periods (treatment_id, tray_number, started_at, ended_at)
          VALUES (1, 2, 200, 300);
        `),
      ).not.toThrow();
      expect(() =>
        sqlite.exec(`
          INSERT INTO tray_periods (treatment_id, tray_number, started_at)
          VALUES (2, 1, 100);
        `),
      ).not.toThrow();
      expect(() =>
        sqlite.exec(`
          INSERT INTO tray_periods (treatment_id, tray_number, started_at)
          VALUES (1, 2, 200);
        `),
      ).toThrow(/UNIQUE constraint failed/);
    } finally {
      sqlite.close();
    }
  });

  it('rejects invalid legacy data without changing it or advancing the schema version', async () => {
    const { db, sqlite } = createVersionFourDatabase();

    try {
      sqlite.exec(`
        INSERT INTO tray_periods (id, treatment_id, tray_number, started_at)
        VALUES (1, 1, 1, 100), (2, 1, 2, 200);
      `);

      await expect(migrateDatabase(db)).rejects.toEqual(
        new DatabaseIntegrityError(
          'Cannot upgrade the local database because treatment 1 has 2 active tray periods.',
        ),
      );

      expect(sqlite.prepare('PRAGMA user_version').get()).toMatchObject({ user_version: 4 });
      expect(
        sqlite
          .prepare(
            `SELECT COUNT(*) AS active_period_count
             FROM tray_periods
             WHERE treatment_id = 1 AND ended_at IS NULL`,
          )
          .get(),
      ).toMatchObject({ active_period_count: 2 });
      expect(
        sqlite
          .prepare(
            `SELECT name
             FROM sqlite_master
             WHERE type = 'index'
               AND name = 'tray_periods_one_active_per_treatment_idx'`,
          )
          .get(),
      ).toBeUndefined();
    } finally {
      sqlite.close();
    }
  });
});
