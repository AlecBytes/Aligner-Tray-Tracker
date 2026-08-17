import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

type AppLoadingScreenProps = {
  message?: string;
};

export function AppLoadingScreen({ message = 'Opening local data…' }: AppLoadingScreenProps) {
  const theme = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ActivityIndicator color={theme.primary} size="large" />
      <AppText muted variant="caption">
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
  },
});
