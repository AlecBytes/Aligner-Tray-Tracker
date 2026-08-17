import { StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { radius, spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

type FeaturePlaceholderProps = {
  description: string;
  title: string;
};

export function FeaturePlaceholder({ description, title }: FeaturePlaceholderProps) {
  const theme = useAppTheme();

  return (
    <AppScreen>
      <View style={styles.heading}>
        <AppText variant="title">{title}</AppText>
        <AppText muted>{description}</AppText>
      </View>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <AppText variant="heading">Foundation ready</AppText>
        <AppText muted>
          This route is connected to the local-first application shell. Product behavior will be
          added in its own focused implementation task.
        </AppText>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  heading: {
    gap: spacing.sm,
    paddingTop: spacing.xl,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
});
