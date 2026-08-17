import { StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { radius, spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

export function AccountScreen() {
  const theme = useAppTheme();

  return (
    <AppScreen>
      <View style={styles.intro}>
        <AppText variant="heading">No account required</AppText>
        <AppText muted>
          Aligner Tracker works fully without an account. Your tracker and treatment plan stay
          available on this device.
        </AppText>
      </View>

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <AppText style={styles.eyebrow} variant="caption">
          CURRENT MODE
        </AppText>
        <AppText variant="heading">On-device only</AppText>
        <AppText muted>No sign-in is needed for any current app feature.</AppText>
      </View>

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <AppText variant="heading">Accounts are coming later</AppText>
        <AppText muted>
          Optional accounts will enable cloud backup, restore, and sync across devices. Sign-in and
          account creation are not available yet.
        </AppText>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  eyebrow: {
    fontWeight: '700',
    letterSpacing: 1,
  },
  intro: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
});
