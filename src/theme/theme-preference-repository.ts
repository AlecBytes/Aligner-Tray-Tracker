import type { SQLiteDatabase } from 'expo-sqlite';
import { isThemeKey, type ThemeKey } from '@/theme/tokens';
export async function getSelectedThemeKey(db: SQLiteDatabase): Promise<ThemeKey> {
  const row = await db.getFirstAsync<{ selected_theme_key: string }>('SELECT selected_theme_key FROM settings WHERE id = 1');
  return isThemeKey(row?.selected_theme_key) ? row.selected_theme_key : 'default';
}
export async function updateSelectedThemeKey(db: SQLiteDatabase, key: ThemeKey) {
  const result = await db.runAsync('UPDATE settings SET selected_theme_key = ? WHERE id = 1', key);
  if (result.changes !== 1) throw new Error('Theme preference could not be saved.');
}
