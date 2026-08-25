import { type Href, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { STATISTICS_GRAPHS } from '@/features/statistics/statistics-graph-config';
import { radius, spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

export function StatisticsGraphsScreen() {
  const router = useRouter();
  const theme = useAppTheme();

  return (
    <AppScreen scrollable>
      <View style={styles.list}>
        {STATISTICS_GRAPHS.map((graph) => (
          <Pressable
            accessibilityHint={`Opens the ${graph.title} graph`}
            accessibilityRole="button"
            key={graph.kind}
            onPress={() =>
              router.push(`/statistics/graphs/${graph.kind}` as Href)
            }
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: pressed ? theme.border : theme.surface,
                borderColor: theme.border,
              },
            ]}>
            <View style={styles.copy}>
              <AppText style={styles.title}>{graph.title}</AppText>
              <AppText muted>{graph.description}</AppText>
            </View>
            <AppText muted>›</AppText>
          </Pressable>
        ))}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
  list: {
    gap: spacing.sm,
  },
  row: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 64,
    padding: spacing.lg,
  },
  title: {
    fontWeight: '700',
  },
});
