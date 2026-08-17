export const colors = {
  light: {
    background: '#F7F8FA',
    surface: '#FFFFFF',
    text: '#111827',
    textMuted: '#5F6B7A',
    border: '#D8DEE8',
    error: '#B42318',
    primary: '#1463FF',
    primaryPressed: '#0E4FCC',
    onPrimary: '#FFFFFF',
  },
  dark: {
    background: '#0B0E14',
    surface: '#151A23',
    text: '#F5F7FA',
    textMuted: '#A9B2C1',
    border: '#303846',
    error: '#FFB4AB',
    primary: '#73A5FF',
    primaryPressed: '#558DEA',
    onPrimary: '#071126',
  },
} as const;

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
