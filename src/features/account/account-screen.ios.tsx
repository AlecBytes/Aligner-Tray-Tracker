import { Form, Host, Label, Section, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';

import { useAppTheme } from '@/theme/use-app-theme';

export function AccountScreen() {
  const theme = useAppTheme();

  return (
    <Host seedColor={theme.primary} style={{ flex: 1 }}>
      <Form>
        <Section>
          <VStack alignment="leading" spacing={8}>
            <Text modifiers={[font({ textStyle: 'title2', weight: 'bold' })]}>
              No account required
            </Text>
            <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
              Aligner Tracker works fully without an account. Your tracker and treatment plan stay
              available on this device.
            </Text>
          </VStack>
        </Section>

        <Section title="Current mode">
          <Label systemImage="iphone" title="On-device only" />
          <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
            No sign-in is needed for any current app feature.
          </Text>
        </Section>

        <Section title="Accounts are coming later">
          <Label systemImage="icloud" title="Optional cloud services" />
          <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
            Optional accounts will enable cloud backup, restore, and sync across devices. Sign-in
            and account creation are not available yet.
          </Text>
        </Section>
      </Form>
    </Host>
  );
}
