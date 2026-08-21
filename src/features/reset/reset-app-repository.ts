import type { SQLiteDatabase } from 'expo-sqlite';

export async function resetAppData(db: SQLiteDatabase) {
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DELETE FROM wear_punches;
      DELETE FROM tray_periods;
      DELETE FROM treatment_plan_versions;
      DELETE FROM treatments;
      DELETE FROM settings;
      INSERT INTO settings (id) VALUES (1);
    `);
  });
}
