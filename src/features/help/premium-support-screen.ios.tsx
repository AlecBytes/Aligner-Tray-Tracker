import { Button, Form, Host, Section, Text } from '@expo/ui/swift-ui';
import { disabled, textSelection } from '@expo/ui/swift-ui/modifiers';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking } from 'react-native';

import { ActionButton, ValidationMessage } from '@/components/expo-ui-components';
import { supportContact } from '@/config/app-config';
import { usePaidAccess } from '@/features/paid-access/paid-access-provider';
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
    <Host seedColor={theme.primary} style={{ flex: 1 }}>
      <Form>
        <Section title="Premium Support">
          <Text>
            {access.hasPremiumAccess
              ? 'Get priority help directly from the developer. Premium Support requests are prioritized ahead of standard support requests.'
              : NON_PRO_COPY}
          </Text>
        </Section>

        <Section title={access.hasPremiumAccess ? 'Contact Premium Support' : 'Contact Support'}>
          <Text modifiers={[textSelection(true)]}>
            {supportContact ?? 'Support email is not configured'}
          </Text>
          {access.hasPremiumAccess ? (
            <ActionButton
              disabled={!supportContact}
              label="Contact Premium Support"
              onPress={() => void contactSupport('premium')}
              systemImage="envelope"
            />
          ) : (
            <>
              <ActionButton
                label="View Aligner Tracker Pro"
                onPress={() => router.push('/premium')}
                systemImage="star"
              />
              <Button
                label="Contact Support"
                modifiers={[disabled(!supportContact)]}
                onPress={() => void contactSupport('standard')}
                systemImage="envelope"
              />
            </>
          )}
          <ValidationMessage
            message={
              contactError
                ? 'No email app could be opened. You can copy the address above.'
                : null
            }
          />
        </Section>
      </Form>
    </Host>
  );
}
