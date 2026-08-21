import { Button, Form, Host, HStack, Section, Text, VStack } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
  font,
  foregroundStyle,
  frame,
  padding,
  textSelection,
} from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';
import { Linking } from 'react-native';

import { ValidationMessage } from '@/components/expo-ui-components';
import { supportContact } from '@/config/app-config';
import { useAppTheme } from '@/theme/use-app-theme';

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
          title="Support">
          <VStack alignment="leading" spacing={10}>
            <Text modifiers={[textSelection(true)]}>{supportContact}</Text>
            <Button
              label="Email support"
              systemImage="envelope"
              modifiers={[
                buttonStyle('bordered'),
                accessibilityLabel(`Email support at ${supportContact}`),
              ]}
              onPress={() => void openSupportEmail()}
            />
          </VStack>
        </Section>
      </Form>
    </Host>
  );
}
