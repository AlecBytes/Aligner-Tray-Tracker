import { Host } from '@expo/ui/swift-ui';
import { Redirect, type Href } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { type ReactNode, useCallback, useEffect, useState } from 'react';

import { AppLoadingScreen } from '@/components/app-loading-screen';
import { CenteredState } from '@/components/expo-ui-components';
import { hasTreatment } from '@/features/treatment/treatment-repository';
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
      <Host seedColor={theme.primary} style={{ flex: 1 }}>
        <CenteredState
          actionLabel="Try again"
          message="Your saved treatment could not be checked. Please try again."
          onAction={retry}
          title="Local data unavailable"
        />
      </Host>
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
