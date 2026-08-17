import { Redirect, type Href } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppLoadingScreen } from '@/components/app-loading-screen';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { hasTreatment } from '@/features/treatment/treatment-repository';
import { radius, spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

type TreatmentRouteGateProps = {
  children?: ReactNode;
  whenMissing?: Href;
  whenPresent?: Href;
};

export function TreatmentRouteGate({
  children = null,
  whenMissing,
  whenPresent,
}: TreatmentRouteGateProps) {
  const db = useSQLiteContext();
  const theme = useAppTheme();
  const [treatmentExists, setTreatmentExists] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  const retry = useCallback(() => {
    setTreatmentExists(null);
    setLoadError(false);
    setLoadAttempt((attempt) => attempt + 1);
  }, []);

  useEffect(() => {
    let active = true;

    void hasTreatment(db)
      .then((exists) => {
        if (active) {
          setTreatmentExists(exists);
          setLoadError(false);
        }
      })
      .catch(() => {
        if (active) {
          setLoadError(true);
        }
      });

    return () => {
      active = false;
    };
  }, [db, loadAttempt]);

  if (loadError) {
    return (
      <AppScreen>
        <View style={styles.message}>
          <AppText variant="heading">Local data unavailable</AppText>
          <AppText muted>Your saved treatment could not be checked. Please try again.</AppText>
          <Pressable
            accessibilityRole="button"
            onPress={retry}
            style={({ pressed }) => [
              styles.retryButton,
              {
                backgroundColor: pressed ? theme.border : theme.surface,
                borderColor: theme.border,
              },
            ]}>
            <AppText style={styles.retryLabel}>Try again</AppText>
          </Pressable>
        </View>
      </AppScreen>
    );
  }

  if (treatmentExists === null) {
    return <AppLoadingScreen message="Checking local data…" />;
  }

  if (treatmentExists && whenPresent !== undefined) {
    return <Redirect href={whenPresent} />;
  }

  if (!treatmentExists && whenMissing !== undefined) {
    return <Redirect href={whenMissing} />;
  }

  return children;
}

const styles = StyleSheet.create({
  message: {
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
  },
  retryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  retryLabel: {
    fontWeight: '700',
  },
});
