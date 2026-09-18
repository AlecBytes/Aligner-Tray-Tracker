import type { SQLiteDatabase } from 'expo-sqlite';

import { withUserMutationTransaction } from '@/db/mutation-transaction';

export async function resetAppData(db: SQLiteDatabase) {
  await withUserMutationTransaction(db, async (transaction) => {
    await transaction.execAsync(`
      DELETE FROM retainer_wear_punches;
      DELETE FROM retainer_periods;
      DELETE FROM retainer_settings;
      INSERT INTO retainer_settings(id) VALUES (1);
      DELETE FROM wear_punches;
      DELETE FROM tray_periods;
      DELETE FROM treatment_plan_versions;
      DELETE FROM treatments;
      DELETE FROM settings;
      INSERT INTO settings (id) VALUES (1);
    `);
  });
}
