import { Button, DisclosureGroup, Form, Host, HStack, Section, Text, VStack } from '@expo/ui/swift-ui';
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
import { useState } from 'react';
import { Linking } from 'react-native';

import { ValidationMessage } from '@/components/expo-ui-components';
import { supportContact } from '@/config/app-config';
import { useAppTheme } from '@/theme/use-app-theme';
import { HELP_CONTENT_SECTIONS } from './help-content';
import { openSupportEmail } from './support-contact';

function HelpItem({ index, ordered, text }: { index: number; ordered: boolean; text: string }) {
  const theme = useAppTheme();

  return (
    <HStack alignment="top" spacing={12} modifiers={[padding({ vertical: 4 })]}>
      <Text
        modifiers={[
          font({ textStyle: 'headline', weight: 'bold' }),
          foregroundStyle(theme.primary),
        ]}>
        {ordered ? `${index + 1}.` : '•'}
      </Text>
      <Text modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>{text}</Text>
    </HStack>
  );
}

export function HelpScreen() {
  const theme = useAppTheme();
  const [contactError, setContactError] = useState(false);
  const [expandedSections, setExpandedSections] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  function setSectionExpanded(title: string, isExpanded: boolean) {
    setExpandedSections((current) => {
      const next = new Set(current);
      if (isExpanded) {
        next.add(title);
      } else {
        next.delete(title);
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
    <Host seedColor={theme.primary} style={{ flex: 1 }}>
      <Form>
        <Section>
          {HELP_CONTENT_SECTIONS.map((section) => {
            const expanded = expandedSections.has(section.title);
            return (
              <DisclosureGroup
                isExpanded={expanded}
                key={section.title}
                label={section.title}
                onIsExpandedChange={(isExpanded) =>
                  setSectionExpanded(section.title, isExpanded)
                }>
                {expanded
                  ? section.items.map((item, index) => (
                      <HelpItem
                        index={index}
                        key={item}
                        ordered={section.ordered === true}
                        text={item}
                      />
                    ))
                  : null}
              </DisclosureGroup>
            );
          })}
        </Section>

        <Section
          footer={
            contactError ? (
              <ValidationMessage message="Email is unavailable on this device. Select and copy the address above instead." />
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
      </Form>
    </Host>
  );
}
