import type { ThemeKey } from '@/theme/tokens';
export function resolveEffectiveThemeKey(selected: ThemeKey, hasPremiumAccess: boolean): ThemeKey {
  return selected === 'default' || hasPremiumAccess ? selected : 'default';
}
