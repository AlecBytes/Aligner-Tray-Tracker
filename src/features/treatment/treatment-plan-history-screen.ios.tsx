import { Host, HStack, List, Section, Spacer, Text } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  background,
  font,
  foregroundStyle,
  padding,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { AppLoadingScreen } from '@/components/app-loading-screen';
import {
  ActionButton,
  CenteredState,
  MetricRow,
  ValidationMessage,
} from '@/components/expo-ui-components';
import {
  createTreatmentPlanHistoryReadModel,
  formatPrescribedMinutes,
  type TreatmentPlanHistoryItem,
} from '@/features/treatment/treatment-plan-history-model';
import { getTreatmentPlanHistory } from '@/features/treatment/treatment-repository';
import { useAppTheme } from '@/theme/use-app-theme';

const effectiveDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function PlanVersionSummary({ version }: { version: TreatmentPlanHistoryItem }) {
  const theme = useAppTheme();

  return (
    <Section
      header={
        <HStack spacing={8}>
          <Text>Effective {effectiveDateFormatter.format(version.effectiveAt)}</Text>
          <Spacer />
          {version.isCurrent ? (
            <Text
              modifiers={[
                accessibilityLabel('Current treatment plan version'),
                font({ textStyle: 'caption', weight: 'semibold' }),
                foregroundStyle(theme.onPrimary),
                padding({ horizontal: 8, vertical: 3 }),
                background(theme.primary, shapes.capsule()),
              ]}>
              Current
            </Text>
          ) : null}
        </HStack>
      }>
      <MetricRow label="Total trays" value={String(version.totalTrays)} />
      <MetricRow label="Days per tray" value={String(version.daysPerTray)} />
      <MetricRow
        label="Prescribed hours per day"
        value={formatPrescribedMinutes(version.dailyWearGoalMinutes)}
      />
    </Section>
  );
}

export function TreatmentPlanHistoryScreen() {
  const db = useSQLiteContext();
  const theme = useAppTheme();
  const [history, setHistory] = useState<TreatmentPlanHistoryItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    const versions = await getTreatmentPlanHistory(db);
    return createTreatmentPlanHistoryReadModel(versions);
  }, [db]);

  const refreshHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      setHistory(await loadHistory());
      setError(null);
    } catch {
      setError('Treatment plan history could not be loaded. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [loadHistory]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setIsLoading(true);

      void loadHistory()
        .then((readModel) => {
          if (active) {
            setHistory(readModel);
            setError(null);
          }
        })
        .catch(() => {
          if (active) {
            setError('Treatment plan history could not be loaded. Please try again.');
          }
        })
        .finally(() => {
          if (active) {
            setIsLoading(false);
          }
        });

      return () => {
        active = false;
      };
    }, [loadHistory]),
  );

  if (history === null) {
    if (isLoading) {
      return <AppLoadingScreen message="Loading plan history…" />;
    }

    return (
      <Host seedColor={theme.primary} style={{ flex: 1 }}>
        <CenteredState
          actionLabel="Try again"
          message={error ?? 'No treatment plan history was found.'}
          onAction={() => void refreshHistory()}
          title="Plan history unavailable"
        />
      </Host>
    );
  }

  return (
    <Host seedColor={theme.primary} style={{ flex: 1 }}>
      <List>
        <Section>
          <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
            Review the saved settings for this treatment.
          </Text>
          {error ? <ValidationMessage message={error} /> : null}
        </Section>

        {history.length === 0 ? (
          <Section title="No plan history">
            <Text>No treatment plan versions were found.</Text>
            <ActionButton label="Reload" onPress={() => void refreshHistory()} prominent={false} />
          </Section>
        ) : (
          history.map((version) => <PlanVersionSummary key={version.id} version={version} />)
        )}
      </List>
    </Host>
  );
}
