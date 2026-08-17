import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { supportContact } from '@/config/app-config';
import { radius, spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

const GETTING_STARTED_STEPS = [
  'Enter the treatment plan prescribed for you during setup.',
  'On the tracker, tap the large button whenever you remove or insert your trays.',
  'Use Change Tray when you begin a different tray. A new tray starts OUT until you mark it IN.',
  'Your timers and current tray are saved on this device and restore when you reopen the app.',
] as const;

export function HelpScreen() {
  const theme = useAppTheme();
  const [contactError, setContactError] = useState(false);

  async function openSupportEmail() {
    setContactError(false);

    try {
      await Linking.openURL(`mailto:${supportContact}`);
    } catch {
      setContactError(true);
    }
  }

  return (
    <AppScreen>
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
        <AppText variant="heading">Support</AppText>
        <AppText muted>Questions or feedback? Contact:</AppText>
        <Pressable
          accessibilityLabel={`Email support at ${supportContact}`}
          accessibilityRole="link"
          onPress={() => void openSupportEmail()}
          style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}>
          <AppText selectable style={[styles.contact, { color: theme.primary }]}>
            {supportContact}
          </AppText>
        </Pressable>
        {contactError ? (
          <AppText accessibilityLiveRegion="polite" style={{ color: theme.error }} variant="caption">
            No email app could be opened. You can copy the address above.
          </AppText>
        ) : null}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
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
