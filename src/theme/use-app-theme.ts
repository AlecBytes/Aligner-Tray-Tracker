import { useColorScheme } from 'react-native';

import { colors } from '@/theme/tokens';

export function useAppTheme() {
  return colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
}
