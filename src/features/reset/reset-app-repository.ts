import type { SQLiteDatabase } from 'expo-sqlite';

import { withUserMutationTransaction } from '@/db/mutation-transaction';

export async function resetAppData(db: SQLiteDatabase) {
  await withUserMutationTransaction(db, async (transaction) => {
    await transaction.execAsync(`
      DELETE FROM wear_punches;
      DELETE FROM tray_periods;
      DELETE FROM treatment_plan_versions;
      DELETE FROM treatments;
      DELETE FROM settings;
      INSERT INTO settings (id) VALUES (1);
    `);
  });
}
