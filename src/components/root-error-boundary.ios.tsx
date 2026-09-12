import { Button, Host, Text, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, disabled, font, frame, padding } from '@expo/ui/swift-ui/modifiers';
import type { ErrorBoundaryProps } from 'expo-router';
import { useState } from 'react';

const APP_SEED_COLOR = '#2F046F';

export function RootErrorBoundary({ retry }: ErrorBoundaryProps) {
  const [isRetrying, setIsRetrying] = useState(false);

  async function retryOpeningApp() {
    if (isRetrying) {
      return;
    }

    setIsRetrying(true);
    try {
      await retry();
    } catch {
      setIsRetrying(false);
    }
  }

  return (
    <Host seedColor={APP_SEED_COLOR} style={{ flex: 1 }}>
      <VStack
        alignment="center"
        spacing={16}
        modifiers={[
          frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'center' }),
          padding({ all: 24 }),
        ]}>
        <Text modifiers={[font({ textStyle: 'title2', weight: 'semibold' })]}>
          Aligner Tracker couldn’t open
        </Text>
        <Text>
          Your local data has not been reset. Try opening it again.
        </Text>
        <Button
          label={isRetrying ? 'Trying Again…' : 'Try Again'}
          modifiers={[buttonStyle('borderedProminent'), disabled(isRetrying)]}
          onPress={() => void retryOpeningApp()}
          systemImage="arrow.clockwise"
        />
      </VStack>
    </Host>
  );
}
