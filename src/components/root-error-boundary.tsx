import type { ErrorBoundaryProps } from 'expo-router';
import { useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';

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
    <View style={styles.container}>
      <Text style={styles.title}>Aligner Tracker couldn’t open</Text>
      <Text style={styles.message}>Your local data has not been reset. Try opening it again.</Text>
      <Button
        disabled={isRetrying}
        onPress={() => void retryOpeningApp()}
        title={isRetrying ? 'Trying Again…' : 'Try Again'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    gap: 16,
    justifyContent: 'center',
    padding: 24,
  },
  message: {
    textAlign: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
  },
});
