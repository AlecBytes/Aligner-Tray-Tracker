import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_VERSION = 8;

type DuplicateActiveTrayPeriodsRow = {
  active_period_count: number;
  treatment_id: number;
};

export class DatabaseIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseIntegrityError';
  }
}

const migrationOne = `
  CREATE TABLE IF NOT EXISTS treatments (
    id INTEGER PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS treatment_plan_versions (
    id INTEGER PRIMARY KEY NOT NULL,
    treatment_id INTEGER NOT NULL,
    total_trays INTEGER NOT NULL CHECK (total_trays > 0),
    days_per_tray INTEGER NOT NULL CHECK (days_per_tray > 0),
    daily_wear_goal_minutes INTEGER NOT NULL
      CHECK (daily_wear_goal_minutes BETWEEN 0 AND 1440),
    effective_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (treatment_id) REFERENCES treatments (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tray_periods (
    id INTEGER PRIMARY KEY NOT NULL,
    treatment_id INTEGER NOT NULL,
    tray_number INTEGER NOT NULL CHECK (tray_number > 0),
    started_at INTEGER NOT NULL,
    ended_at INTEGER CHECK (ended_at IS NULL OR ended_at >= started_at),
    FOREIGN KEY (treatment_id) REFERENCES treatments (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS wear_punches (
    id INTEGER PRIMARY KEY NOT NULL,
    tray_period_id INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('IN', 'OUT')),
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (tray_period_id) REFERENCES tray_periods (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY NOT NULL DEFAULT 1 CHECK (id = 1),
    out_reminder_minutes INTEGER NOT NULL DEFAULT 45 CHECK (out_reminder_minutes > 0),
    notifications_enabled INTEGER NOT NULL DEFAULT 0 CHECK (notifications_enabled IN (0, 1))
  );

  CREATE INDEX IF NOT EXISTS treatment_plan_versions_current_idx
    ON treatment_plan_versions (treatment_id, effective_at DESC);
  CREATE INDEX IF NOT EXISTS tray_periods_current_idx
    ON tray_periods (treatment_id, ended_at, started_at DESC);
  CREATE INDEX IF NOT EXISTS wear_punches_timeline_idx
    ON wear_punches (tray_period_id, timestamp);

  INSERT OR IGNORE INTO settings (id) VALUES (1);
`;

const migrationTwo = `
  ALTER TABLE settings
    ADD COLUMN out_reminder_enabled INTEGER NOT NULL DEFAULT 1
      CHECK (out_reminder_enabled IN (0, 1));
  ALTER TABLE settings
    ADD COLUMN tray_change_reminder_enabled INTEGER NOT NULL DEFAULT 1
      CHECK (tray_change_reminder_enabled IN (0, 1));
  ALTER TABLE settings
    ADD COLUMN tray_change_reminder_hour INTEGER NOT NULL DEFAULT 9
      CHECK (tray_change_reminder_hour BETWEEN 0 AND 23);
  ALTER TABLE settings
    ADD COLUMN tray_change_reminder_minute INTEGER NOT NULL DEFAULT 0
      CHECK (tray_change_reminder_minute BETWEEN 0 AND 59);
`;

const migrationThree = `
  ALTER TABLE settings
    ADD COLUMN out_persistent_reminder_interval_minutes INTEGER NOT NULL DEFAULT 5
      CHECK (out_persistent_reminder_interval_minutes BETWEEN 5 AND 240);
`;

const migrationFour = `
  CREATE TABLE IF NOT EXISTS app_installation (
    id INTEGER PRIMARY KEY NOT NULL DEFAULT 1 CHECK (id = 1),
    installation_id TEXT NOT NULL UNIQUE
  );

  INSERT OR IGNORE INTO app_installation (id, installation_id)
  VALUES (1, lower(hex(randomblob(32))));
`;

const migrationFive = `
  CREATE UNIQUE INDEX IF NOT EXISTS tray_periods_one_active_per_treatment_idx
    ON tray_periods (treatment_id)
    WHERE ended_at IS NULL;
`;
const migrationSix = `
  ALTER TABLE settings ADD COLUMN selected_theme_key TEXT NOT NULL DEFAULT 'default';
`;

const migrationSeven = `
  ALTER TABLE settings
    ADD COLUMN tray_change_overdue_reminder_enabled INTEGER NOT NULL DEFAULT 0
      CHECK (tray_change_overdue_reminder_enabled IN (0, 1));
`;

const migrationEight = `
  ALTER TABLE treatments ADD COLUMN completed_at INTEGER
    CHECK (completed_at IS NULL OR completed_at >= created_at);
  CREATE UNIQUE INDEX treatments_one_active ON treatments ((1)) WHERE completed_at IS NULL;
  CREATE UNIQUE INDEX tray_periods_one_active ON tray_periods ((1)) WHERE ended_at IS NULL;
  CREATE TABLE retainer_periods (
    id INTEGER PRIMARY KEY NOT NULL,
    treatment_id INTEGER NOT NULL REFERENCES treatments(id) ON DELETE CASCADE,
    started_at INTEGER NOT NULL,
    ended_at INTEGER CHECK (ended_at IS NULL OR ended_at >= started_at)
  );
  CREATE UNIQUE INDEX retainer_periods_one_active ON retainer_periods ((1)) WHERE ended_at IS NULL;
  CREATE TABLE retainer_wear_punches (
    id INTEGER PRIMARY KEY NOT NULL,
    retainer_period_id INTEGER NOT NULL REFERENCES retainer_periods(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('IN', 'OUT')),
    timestamp INTEGER NOT NULL,
    origin TEXT NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual','automatic','lifecycle','correction')),
    auto_out_suppressed INTEGER NOT NULL DEFAULT 0 CHECK (auto_out_suppressed IN (0,1))
  );
  CREATE INDEX retainer_punches_timeline ON retainer_wear_punches(retainer_period_id, timestamp, id);
  CREATE TABLE retainer_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    bedtime_enabled INTEGER NOT NULL DEFAULT 1 CHECK (bedtime_enabled IN (0,1)),
    bedtime_minutes INTEGER NOT NULL DEFAULT 1320 CHECK (bedtime_minutes BETWEEN 0 AND 1439),
    morning_enabled INTEGER NOT NULL DEFAULT 1 CHECK (morning_enabled IN (0,1)),
    morning_minutes INTEGER NOT NULL DEFAULT 420 CHECK (morning_minutes BETWEEN 0 AND 1439),
    automatic_enabled INTEGER NOT NULL DEFAULT 0 CHECK (automatic_enabled IN (0,1)),
    automatic_minutes INTEGER NOT NULL DEFAULT 420 CHECK (automatic_minutes BETWEEN 0 AND 1439),
    automatic_effective_at INTEGER NOT NULL DEFAULT 0
  );
  INSERT INTO retainer_settings(id) VALUES (1);
  CREATE TRIGGER retainer_active_insert BEFORE INSERT ON retainer_periods
  WHEN NEW.ended_at IS NULL AND (
    EXISTS(SELECT 1 FROM tray_periods WHERE ended_at IS NULL) OR
    EXISTS(SELECT 1 FROM treatments WHERE completed_at IS NULL) OR
    NOT EXISTS(SELECT 1 FROM treatments WHERE id = NEW.treatment_id AND completed_at <= NEW.started_at)
  ) BEGIN SELECT RAISE(ABORT, 'Invalid active retainer period'); END;
  CREATE TRIGGER retainer_active_update BEFORE UPDATE ON retainer_periods
  WHEN NEW.ended_at IS NULL AND (
    EXISTS(SELECT 1 FROM tray_periods WHERE ended_at IS NULL) OR
    EXISTS(SELECT 1 FROM treatments WHERE completed_at IS NULL) OR
    NOT EXISTS(SELECT 1 FROM treatments WHERE id = NEW.treatment_id AND completed_at <= NEW.started_at)
  ) BEGIN SELECT RAISE(ABORT, 'Invalid active retainer period'); END;
  CREATE TRIGGER tray_active_insert BEFORE INSERT ON tray_periods
  WHEN NEW.ended_at IS NULL AND (EXISTS(SELECT 1 FROM retainer_periods WHERE ended_at IS NULL)
    OR NOT EXISTS(SELECT 1 FROM treatments WHERE id = NEW.treatment_id AND completed_at IS NULL))
  BEGIN SELECT RAISE(ABORT, 'Invalid active tray period'); END;
  CREATE TRIGGER tray_active_update BEFORE UPDATE ON tray_periods
  WHEN NEW.ended_at IS NULL AND (EXISTS(SELECT 1 FROM retainer_periods WHERE ended_at IS NULL)
    OR NOT EXISTS(SELECT 1 FROM treatments WHERE id = NEW.treatment_id AND completed_at IS NULL))
  BEGIN SELECT RAISE(ABORT, 'Invalid active tray period'); END;
  CREATE TRIGGER treatment_active_insert BEFORE INSERT ON treatments
  WHEN NEW.completed_at IS NULL AND EXISTS(SELECT 1 FROM retainer_periods WHERE ended_at IS NULL)
  BEGIN SELECT RAISE(ABORT, 'Retainer mode is active'); END;
  CREATE TRIGGER treatment_lifecycle_update BEFORE UPDATE ON treatments
  WHEN (OLD.completed_at IS NOT NULL AND NEW.completed_at IS NOT OLD.completed_at)
    OR (NEW.completed_at IS NOT NULL AND EXISTS(SELECT 1 FROM tray_periods WHERE treatment_id = NEW.id AND ended_at IS NULL))
    OR (NEW.completed_at IS NULL AND EXISTS(SELECT 1 FROM retainer_periods WHERE ended_at IS NULL))
  BEGIN SELECT RAISE(ABORT, 'Invalid treatment lifecycle'); END;
`;

export async function migrateDatabase(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');

  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = result?.user_version ?? 0;

  if (currentVersion > DATABASE_VERSION) {
    throw new Error(
      `Database version ${currentVersion} is newer than supported version ${DATABASE_VERSION}.`,
    );
  }

  // Migrations run during SQLiteProvider initialization before app consumers receive the database.
  // They intentionally keep the broadly supported transaction API, including on web.
  if (currentVersion < 1) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(migrationOne);
      await db.execAsync('PRAGMA user_version = 1');
    });
  }

  if (currentVersion < 2) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(migrationTwo);
      await db.execAsync('PRAGMA user_version = 2');
    });
  }

  if (currentVersion < 3) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(migrationThree);
      await db.execAsync('PRAGMA user_version = 3');
    });
  }

  if (currentVersion < 4) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(migrationFour);
      await db.execAsync('PRAGMA user_version = 4');
    });
  }

  if (currentVersion < 5) {
    await db.withTransactionAsync(async () => {
      const duplicateActiveTrayPeriods =
        await db.getFirstAsync<DuplicateActiveTrayPeriodsRow>(
          `SELECT treatment_id, COUNT(*) AS active_period_count
           FROM tray_periods
           WHERE ended_at IS NULL
           GROUP BY treatment_id
           HAVING COUNT(*) > 1
           ORDER BY treatment_id
           LIMIT 1`,
        );

      if (duplicateActiveTrayPeriods !== null) {
        throw new DatabaseIntegrityError(
          `Cannot upgrade the local database because treatment ${duplicateActiveTrayPeriods.treatment_id} has ${duplicateActiveTrayPeriods.active_period_count} active tray periods.`,
        );
      }

      await db.execAsync(migrationFive);
      await db.execAsync('PRAGMA user_version = 5');
    });
  }
  if (currentVersion < 6) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(migrationSix);
      await db.execAsync('PRAGMA user_version = 6');
    });
  }
  if (currentVersion < 7) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(migrationSeven);
      await db.execAsync('PRAGMA user_version = 7');
    });
  }
  if (currentVersion < 8) {
    await db.withTransactionAsync(async () => {
      const invalid = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM treatments',
      );
      if ((invalid?.count ?? 0) > 1) {
        throw new DatabaseIntegrityError('Cannot upgrade multiple unfinished legacy treatments.');
      }
      await db.execAsync(migrationEight);
      await db.execAsync('PRAGMA user_version = 8');
    });
  }
}
