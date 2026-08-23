import type { SQLiteDatabase } from 'expo-sqlite';

type AppInstallationRow = {
  installation_id: string;
};

export async function getAppInstallationId(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<AppInstallationRow>(
    'SELECT installation_id FROM app_installation WHERE id = 1',
  );

  if (!row?.installation_id) {
    throw new Error('Local installation metadata is unavailable.');
  }

  return row.installation_id;
}
