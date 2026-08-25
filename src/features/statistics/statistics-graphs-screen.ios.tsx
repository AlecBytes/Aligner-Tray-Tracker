import { Button, HStack, Host, Image, List, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  accessibilityHint,
  buttonStyle,
  font,
  foregroundStyle,
  frame,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import { type Href, useRouter } from 'expo-router';

import { STATISTICS_GRAPHS } from '@/features/statistics/statistics-graph-config';
import { useAppTheme } from '@/theme/use-app-theme';

export function StatisticsGraphsScreen() {
  const router = useRouter();
  const theme = useAppTheme();

  return (
    <Host seedColor={theme.primary} style={{ flex: 1 }}>
      <List>
        <Section>
          {STATISTICS_GRAPHS.map((graph) => (
            <Button
              key={graph.kind}
              modifiers={[
                accessibilityHint(`Opens the ${graph.title} graph`),
                buttonStyle('plain'),
              ]}
              onPress={() =>
                router.push(
                  `/statistics/graphs/${graph.kind}` as Href,
                )
              }>
              <HStack
                spacing={12}
                modifiers={[
                  frame({ maxWidth: Infinity, minHeight: 52, alignment: 'leading' }),
                  padding({ vertical: 6 }),
                ]}>
                <VStack alignment="leading" spacing={4}>
                  <Text modifiers={[font({ weight: 'semibold' })]}>{graph.title}</Text>
                  <Text
                    modifiers={[
                      font({ textStyle: 'caption' }),
                      foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                    ]}>
                    {graph.description}
                  </Text>
                </VStack>
                <Spacer />
                <Image color="secondary" size={14} systemName="chevron.right" />
              </HStack>
            </Button>
          ))}
        </Section>
      </List>
    </Host>
  );
}
