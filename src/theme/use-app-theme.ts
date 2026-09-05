import { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import { themeColors, type ThemeKey } from '@/theme/tokens';

export type AppThemeContextValue = { effectiveThemeKey: ThemeKey; savedThemeKey: ThemeKey; selectTheme: (key: ThemeKey) => Promise<void>; reloadTheme: () => Promise<void> };
export const AppThemeContext = createContext<AppThemeContextValue>({ effectiveThemeKey: 'default', savedThemeKey: 'default', selectTheme: async () => undefined, reloadTheme: async () => undefined });
export function useAppThemeState() { return useContext(AppThemeContext); }

export function useAppTheme() {
  const { effectiveThemeKey } = useAppThemeState();
  return themeColors(effectiveThemeKey, useColorScheme() === 'dark' ? 'dark' : 'light');
}
