import { Button, Form, Host, HStack, Section, Text, VStack } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
  disabled,
  font,
  foregroundStyle,
  frame,
  padding,
  textSelection,
} from '@expo/ui/swift-ui/modifiers';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking } from 'react-native';

import { NavigationRow, ValidationMessage } from '@/components/expo-ui-components';
import { supportContact } from '@/config/app-config';
import { useAppTheme } from '@/theme/use-app-theme';
import { openSupportEmail } from './support-contact';

const GETTING_STARTED_STEPS = [
  'Enter the treatment plan prescribed for you during setup.',
  'On the tracker, tap the large button whenever you remove or insert your trays.',
  'Use Change Tray when you begin a different tray. A new tray starts OUT until you mark it IN.',
  'Your timers and current tray are saved on this device and restore when you reopen the app.',
] as const;

function GettingStartedStep({ index, step }: { index: number; step: string }) {
  const theme = useAppTheme();

  return (
    <HStack alignment="top" spacing={12} modifiers={[padding({ vertical: 4 })]}>
      <Text
        modifiers={[
          font({ textStyle: 'headline', weight: 'bold' }),
          foregroundStyle(theme.primary),
        ]}>
        {index + 1}.
      </Text>
      <Text modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>{step}</Text>
    </HStack>
  );
}

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
    <Host seedColor={theme.primary} style={{ flex: 1 }}>
      <Form>
        <Section title="Getting started">
          {GETTING_STARTED_STEPS.map((step, index) => (
            <GettingStartedStep index={index} key={step} step={step} />
          ))}
        </Section>

        <Section
          footer={
            contactError ? (
              <ValidationMessage message="No email app could be opened. You can copy the address above." />
            ) : (
              <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
                Questions or feedback are welcome.
              </Text>
            )
          }
          title="Contact Support">
          <VStack alignment="leading" spacing={10}>
            <Text modifiers={[textSelection(true)]}>
              {supportContact ?? 'Support email is not configured'}
            </Text>
            <Button
              label="Email support"
              systemImage="envelope"
              modifiers={[
                buttonStyle('bordered'),
                disabled(!supportContact),
                accessibilityLabel('Contact Support'),
              ]}
              onPress={() => void contactSupport()}
            />
          </VStack>
        </Section>

        <Section>
          <NavigationRow
            label="Premium Support"
            onPress={() => router.push('/premium-support' as never)}
            secondaryValue="PRO"
            systemImage="star.bubble"
          />
        </Section>
      </Form>
    </Host>
  );
}
