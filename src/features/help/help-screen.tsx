import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { supportContact } from '@/config/app-config';
import { radius, spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';
import { HELP_CONTENT_SECTIONS } from './help-content';
import { openSupportEmail } from './support-contact';

export function HelpScreen() {
  const theme = useAppTheme();
  const [contactError, setContactError] = useState(false);
  const [expandedSections, setExpandedSections] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  function toggleSection(title: string) {
    setExpandedSections((current) => {
      const next = new Set(current);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  }

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
      {HELP_CONTENT_SECTIONS.map((section) => {
        const expanded = expandedSections.has(section.title);
        return (
          <View
            key={section.title}
            style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              onPress={() => toggleSection(section.title)}
              style={styles.sectionHeader}>
              <AppText style={styles.sectionTitle} variant="heading">{section.title}</AppText>
              <AppText
                accessibilityElementsHidden
                importantForAccessibility="no"
                style={{ color: theme.primary }}>
                {expanded ? '⌄' : '›'}
              </AppText>
            </Pressable>
            {expanded ? (
              <View style={styles.items}>
                {section.items.map((item, index) => (
                  <View key={item} style={styles.item}>
                    <AppText
                      accessibilityElementsHidden
                      importantForAccessibility="no"
                      style={[styles.itemMarker, { color: theme.primary }]}
                      variant="caption">
                      {section.ordered ? `${index + 1}.` : '•'}
                    </AppText>
                    <AppText style={styles.itemText}>{item}</AppText>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}

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
            Email is unavailable on this device. Select and copy the address above instead.
          </AppText>
        ) : null}
      </View>

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
    padding: spacing.lg,
  },
  contact: {
    fontWeight: '700',
  },
  itemMarker: {
    fontWeight: '700',
    minWidth: 22,
  },
  item: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  items: {
    gap: spacing.sm,
  },
  itemText: {
    flex: 1,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  sectionTitle: {
    flex: 1,
  },
});
