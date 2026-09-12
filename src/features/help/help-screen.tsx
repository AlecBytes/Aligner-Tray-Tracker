import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { supportContact } from '@/config/app-config';
import { radius, spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';
import { openSupportEmail } from './support-contact';

const GETTING_STARTED_STEPS = [
  'Enter the treatment plan prescribed for you during setup.',
  'On the tracker, tap the large button whenever you remove or insert your trays.',
  'Use Change Tray when you begin a different tray. A new tray starts OUT until you mark it IN.',
  'Your timers and current tray are saved on this device and restore when you reopen the app.',
] as const;

export function HelpScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const [contactError, setContactError] = useState(false);

  async function contactSupport() {
    setContactError(false);
    const opened = await openSupportEmail({
      contact: supportContact,
      intent: 'standard',
      openUrl: Linking.openURL,
    });
    if (!opened) {
      setContactError(true);
    }
  }

  return (
    <AppScreen scrollable>
      <View style={styles.section}>
        <AppText variant="heading">Getting started</AppText>
        <View style={styles.steps}>
          {GETTING_STARTED_STEPS.map((step, index) => (
            <View key={step} style={styles.step}>
              <View style={[styles.stepNumber, { backgroundColor: theme.primary }]}>
                <AppText
                  style={[styles.stepNumberLabel, { color: theme.onPrimary }]}
                  variant="caption">
                  {index + 1}
                </AppText>
              </View>
              <AppText style={styles.stepText}>{step}</AppText>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <AppText variant="heading">Contact Support</AppText>
        <AppText muted>Questions or feedback are welcome.</AppText>
        <AppText selectable style={[styles.contact, supportContact && { color: theme.primary }]}>
          {supportContact ?? 'Support email is not configured'}
        </AppText>
        <Pressable
          accessibilityLabel="Contact Support"
          accessibilityRole="button"
          accessibilityState={{ disabled: !supportContact }}
          disabled={!supportContact}
          onPress={() => void contactSupport()}
          style={({ pressed }) => [
            styles.action,
            {
              backgroundColor: theme.primary,
              opacity: !supportContact ? 0.5 : pressed ? 0.65 : 1,
            },
          ]}>
          <AppText style={{ color: theme.onPrimary }}>Email support</AppText>
        </Pressable>
        {contactError ? (
          <AppText accessibilityLiveRegion="polite" style={{ color: theme.error }} variant="caption">
            No email app could be opened. You can copy the address above.
          </AppText>
        ) : null}
      </View>

      <Pressable
        accessibilityLabel="Premium Support, Pro"
        accessibilityRole="button"
        onPress={() => router.push('/premium-support' as never)}
        style={({ pressed }) => [
          styles.navigationRow,
          {
            backgroundColor: pressed ? theme.border : theme.surface,
            borderColor: theme.border,
          },
        ]}>
        <AppText style={styles.navigationLabel}>Premium Support</AppText>
        <View style={styles.navigationAccessory}>
          <AppText muted variant="caption">PRO</AppText>
          <AppText muted>›</AppText>
        </View>
      </Pressable>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: 'center',
    borderRadius: radius.md,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.lg,
  },
  contact: {
    fontWeight: '700',
  },
  navigationAccessory: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  navigationLabel: {
    fontWeight: '700',
  },
  navigationRow: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  section: {
    gap: spacing.md,
  },
  step: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
  },
  stepNumber: {
    alignItems: 'center',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  stepNumberLabel: {
    fontWeight: '800',
  },
  stepText: {
    flex: 1,
  },
  steps: {
    gap: spacing.md,
  },
});
