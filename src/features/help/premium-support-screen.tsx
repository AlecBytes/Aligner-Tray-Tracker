import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { supportContact } from '@/config/app-config';
import { usePaidAccess } from '@/features/paid-access/paid-access-provider';
import { radius, spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';
import { openSupportEmail } from './support-contact';

const NON_PRO_COPY =
  'Premium Support is included with Aligner Tracker Pro. Pro requests receive priority handling and more personalized troubleshooting. Standard support remains available to everyone.';

export function PremiumSupportScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { access } = usePaidAccess();
  const [contactError, setContactError] = useState(false);

  async function contactSupport(intent: 'standard' | 'premium') {
    setContactError(false);
    const opened = await openSupportEmail({
      contact: supportContact,
      intent,
      openUrl: Linking.openURL,
    });
    if (!opened) setContactError(true);
  }

  return (
    <AppScreen scrollable>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <AppText variant="heading">Premium Support</AppText>
        <AppText>
          {access.hasPremiumAccess
            ? 'Get priority help directly from the developer. Premium Support requests are prioritized ahead of standard support requests.'
            : NON_PRO_COPY}
        </AppText>
      </View>

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <AppText variant="heading">
          {access.hasPremiumAccess ? 'Contact Premium Support' : 'Contact Support'}
        </AppText>
        <AppText selectable style={styles.contact}>
          {supportContact ?? 'Support email is not configured'}
        </AppText>
        {access.hasPremiumAccess ? (
          <Action
            disabled={!supportContact}
            label="Contact Premium Support"
            onPress={() => void contactSupport('premium')}
          />
        ) : (
          <>
            <Action label="View Aligner Tracker Pro" onPress={() => router.push('/premium')} />
            <Action
              disabled={!supportContact}
              label="Contact Support"
              onPress={() => void contactSupport('standard')}
              secondary
            />
          </>
        )}
        {contactError ? (
          <AppText accessibilityLiveRegion="polite" style={{ color: theme.error }} variant="caption">
            No email app could be opened. You can copy the address above.
          </AppText>
        ) : null}
      </View>
    </AppScreen>
  );
}

function Action({
  disabled = false,
  label,
  onPress,
  secondary = false,
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  secondary?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: secondary ? theme.surface : theme.primary,
          borderColor: theme.primary,
          opacity: disabled ? 0.5 : pressed ? 0.65 : 1,
        },
      ]}>
      <AppText style={{ color: secondary ? theme.primary : theme.onPrimary }}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    padding: spacing.lg,
  },
  contact: {
    fontWeight: '700',
  },
});
