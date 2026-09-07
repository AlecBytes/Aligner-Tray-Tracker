export const themeKeys = ['default', 'blue', 'teal', 'green', 'orange', 'pink'] as const;
export type ThemeKey = (typeof themeKeys)[number];
export type AppColorScheme = 'light' | 'dark';

const neutrals = {
  light: { background: '#F7F8FA', surface: '#FFFFFF', text: '#111827', textMuted: '#5F6B7A', border: '#D8DEE8', error: '#B42318' },
  dark: { background: '#0B0E14', surface: '#151A23', text: '#F5F7FA', textMuted: '#A9B2C1', border: '#303846', error: '#FFB4AB' },
} as const;
const accents = {
  default: { light: ['#580FBD', '#430A96', '#FFFFFF'], dark: ['#9955FF', '#8040E6', '#171020'] },
  blue: { light: ['#0047AB', '#003887', '#FFFFFF'], dark: ['#4D85FF', '#336DE6', '#071126'] },
  teal: { light: ['#00859A', '#006D80', '#FFFFFF'], dark: ['#45D6E8', '#20BACE', '#071A20'] },
  green: { light: ['#4CBB17', '#3E9B12', '#0B1C12'], dark: ['#6CDB32', '#55BD20', '#0B1C12'] },
  orange: { light: ['#FF9500', '#E58300', '#211207'], dark: ['#FFAD33', '#FF9500', '#211207'] },
  pink: { light: ['#FF1493', '#E6007E', '#24101B'], dark: ['#FF4DB3', '#FF1493', '#24101B'] },
} as const;
export const themeNames: Record<ThemeKey, string> = { default: 'Default', blue: 'Blue', teal: 'Teal', green: 'Green', orange: 'Orange', pink: 'Pink' };
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
