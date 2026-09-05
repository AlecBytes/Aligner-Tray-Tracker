import type { SQLiteDatabase } from 'expo-sqlite';
import { getSelectedThemeKey, updateSelectedThemeKey } from './theme-preference-repository';
describe('theme preference repository', () => {
  it('reads valid keys and falls back for invalid or missing values', async () => { const db = { getFirstAsync: jest.fn().mockResolvedValueOnce({ selected_theme_key: 'teal' }).mockResolvedValueOnce({ selected_theme_key: 'future' }).mockResolvedValueOnce(null) } as unknown as SQLiteDatabase; await expect(getSelectedThemeKey(db)).resolves.toBe('teal'); await expect(getSelectedThemeKey(db)).resolves.toBe('default'); await expect(getSelectedThemeKey(db)).resolves.toBe('default'); });
  it('updates exactly the singleton row', async () => { const runAsync = jest.fn().mockResolvedValue({ changes: 1 }); const db = { runAsync } as unknown as SQLiteDatabase; await updateSelectedThemeKey(db, 'orange'); expect(runAsync).toHaveBeenCalledWith(expect.stringContaining('WHERE id = 1'), 'orange'); });
  it('rejects a missing singleton row', async () => { const db = { runAsync: jest.fn().mockResolvedValue({ changes: 0 }) } as unknown as SQLiteDatabase; await expect(updateSelectedThemeKey(db, 'pink')).rejects.toThrow('could not be saved'); });
});
