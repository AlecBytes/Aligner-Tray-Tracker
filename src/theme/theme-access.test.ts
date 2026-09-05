import { resolveEffectiveThemeKey } from './theme-access';
import { isThemeKey, themeColors, themeKeys } from './tokens';
describe('theme catalog and access', () => {
  it('contains the six stable palettes for both appearances', () => { expect(themeKeys).toEqual(['default', 'purple', 'teal', 'green', 'orange', 'pink']); for (const key of themeKeys) { expect(themeColors(key, 'light').primary).toMatch(/^#[0-9A-F]{6}$/); expect(themeColors(key, 'dark').primary).toMatch(/^#[0-9A-F]{6}$/); } });
  it('uses Default for a locked paid selection and restores the saved key with access', () => { expect(resolveEffectiveThemeKey('purple', false)).toBe('default'); expect(resolveEffectiveThemeKey('purple', true)).toBe('purple'); expect(resolveEffectiveThemeKey('default', false)).toBe('default'); });
  it('rejects unknown persisted keys', () => { expect(isThemeKey('seasonal')).toBe(false); expect(isThemeKey('pink')).toBe(true); });
});
