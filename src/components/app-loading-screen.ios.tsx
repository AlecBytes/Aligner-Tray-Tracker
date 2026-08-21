import { Host, ProgressView, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, frame, padding } from '@expo/ui/swift-ui/modifiers';

import { useAppTheme } from '@/theme/use-app-theme';

type AppLoadingScreenProps = {
  message?: string;
};

export function AppLoadingScreen({ message = 'Opening local data…' }: AppLoadingScreenProps) {
  const theme = useAppTheme();

  return (
    <Host seedColor={theme.primary} style={{ flex: 1 }}>
      <VStack
        spacing={16}
        modifiers={[
          frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'center' }),
          padding({ all: 24 }),
        ]}>
        <ProgressView />
        <Text
          modifiers={[
            font({ textStyle: 'caption' }),
            foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
          ]}>
          {message}
        </Text>
      </VStack>
    </Host>
  );
}
