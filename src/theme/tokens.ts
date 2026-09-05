export const themeKeys = ['default', 'purple', 'teal', 'green', 'orange', 'pink'] as const;
export type ThemeKey = (typeof themeKeys)[number];
export type AppColorScheme = 'light' | 'dark';

const neutrals = {
  light: { background: '#F7F8FA', surface: '#FFFFFF', text: '#111827', textMuted: '#5F6B7A', border: '#D8DEE8', error: '#B42318' },
  dark: { background: '#0B0E14', surface: '#151A23', text: '#F5F7FA', textMuted: '#A9B2C1', border: '#303846', error: '#FFB4AB' },
} as const;
const accents = {
  default: { light: ['#1463FF', '#0E4FCC', '#FFFFFF'], dark: ['#73A5FF', '#558DEA', '#071126'] },
  purple: { light: ['#7E22CE', '#6B21A8', '#FFFFFF'], dark: ['#C084FC', '#A855F7', '#171020'] },
  teal: { light: ['#0F766E', '#115E59', '#FFFFFF'], dark: ['#5EEAD4', '#2DD4BF', '#071B18'] },
  green: { light: ['#15803D', '#166534', '#FFFFFF'], dark: ['#86EFAC', '#4ADE80', '#0B1C12'] },
  orange: { light: ['#C2410C', '#9A3412', '#FFFFFF'], dark: ['#FDBA74', '#FB923C', '#211207'] },
  pink: { light: ['#BE185D', '#9D174D', '#FFFFFF'], dark: ['#F9A8D4', '#F472B6', '#24101B'] },
} as const;
export const themeNames: Record<ThemeKey, string> = { default: 'Default', purple: 'Purple', teal: 'Teal', green: 'Green', orange: 'Orange', pink: 'Pink' };
export function isThemeKey(value: unknown): value is ThemeKey {
  return typeof value === 'string' && (themeKeys as readonly string[]).includes(value);
}
export function themeColors(key: ThemeKey, scheme: AppColorScheme) {
  const [primary, primaryPressed, onPrimary] = accents[key][scheme];
  return { ...neutrals[scheme], primary, primaryPressed, onPrimary };
}
export const colors = { light: themeColors('default', 'light'), dark: themeColors('default', 'dark') } as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
} as const;
