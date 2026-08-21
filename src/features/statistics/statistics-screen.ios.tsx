import { Host, HStack, Image, List, Section, Spacer, Text } from '@expo/ui/swift-ui';
import { font, foregroundStyle, monospacedDigit } from '@expo/ui/swift-ui/modifiers';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { AppLoadingScreen } from '@/components/app-loading-screen';
import {
  CenteredState,
  MetricRow,
  ValidationMessage,
} from '@/components/expo-ui-components';
import {
  createStatisticsReadModel,
  formatStatisticsDuration,
} from '@/features/statistics/statistics-calculations';
import type {
  RecentTreatmentDay,
  StatisticsReadModel,
  StatisticsSummary,
} from '@/features/statistics/statistics-model';
import { getStatisticsSnapshot } from '@/features/statistics/statistics-repository';
import { useAppTheme } from '@/theme/use-app-theme';

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  weekday: 'short',
});

function StatisticsSummaryRows({
  daysWorn,
  summary,
}: {
  daysWorn?: number;
  summary: StatisticsSummary;
}) {
  return (
    <>
      {daysWorn === undefined ? null : <MetricRow label="Days worn" value={String(daysWorn)} />}
      <MetricRow
        label="Average IN per tracked day"
        value={formatStatisticsDuration(summary.averageInSeconds)}
      />
      <MetricRow
        label="Average OUT per tracked day"
        value={formatStatisticsDuration(summary.averageOutSeconds)}
      />
      <MetricRow
        label="Days meeting prescribed goal"
        value={`${summary.goalMetDays} / ${summary.trackedDays}`}
      />
    </>
  );
}

function RecentDaySummary({ day }: { day: RecentTreatmentDay }) {
  return (
    <Section
      header={
        <HStack spacing={8}>
          <Text modifiers={[font({ weight: 'semibold' })]}>
            {dateFormatter.format(day.dateStart)}
          </Text>
          <Spacer />
          <Image
            color={day.goalMet ? 'green' : 'secondary'}
            size={16}
            systemName={day.goalMet ? 'checkmark.circle.fill' : 'circle'}
          />
          <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
            {day.goalMet ? 'Goal met' : 'Goal not met'}
          </Text>
        </HStack>
      }>
      <HStack>
        <Text>IN</Text>
        <Spacer />
        <Text modifiers={[font({ weight: 'semibold' }), monospacedDigit()]}>
          {formatStatisticsDuration(day.inSeconds)}
        </Text>
      </HStack>
      <HStack>
        <Text>OUT</Text>
        <Spacer />
        <Text modifiers={[font({ weight: 'semibold' }), monospacedDigit()]}>
          {formatStatisticsDuration(day.outSeconds)}
        </Text>
      </HStack>
    </Section>
  );
}

export function StatisticsScreen() {
  const db = useSQLiteContext();
  const theme = useAppTheme();
  const [statistics, setStatistics] = useState<StatisticsReadModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStatistics = useCallback(async () => {
    const snapshot = await getStatisticsSnapshot(db);
    if (snapshot === null) {
      throw new Error('No active treatment history exists.');
    }
    return createStatisticsReadModel(snapshot, Date.now());
  }, [db]);

  const refreshStatistics = useCallback(async () => {
    setIsLoading(true);
    try {
      setStatistics(await loadStatistics());
      setError(null);
    } catch {
      setError('Statistics could not be loaded. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [loadStatistics]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setIsLoading(true);

      void loadStatistics()
        .then((readModel) => {
          if (active) {
            setStatistics(readModel);
            setError(null);
          }
        })
        .catch(() => {
          if (active) {
            setError('Statistics could not be loaded. Please try again.');
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
    }, [loadStatistics]),
  );

  if (statistics === null) {
    if (isLoading) {
      return <AppLoadingScreen message="Loading statistics…" />;
    }

    return (
      <Host seedColor={theme.primary} style={{ flex: 1 }}>
        <CenteredState
          actionLabel="Try again"
          message={error ?? 'No treatment history was found.'}
          onAction={() => void refreshStatistics()}
          title="Statistics unavailable"
        />
      </Host>
    );
  }

  return (
    <Host seedColor={theme.primary} style={{ flex: 1 }}>
      <List>
        {error ? (
          <Section>
            <ValidationMessage message={error} />
          </Section>
        ) : null}
        <Section title="Current Tray">
          <StatisticsSummaryRows
            daysWorn={statistics.currentTray.daysWorn}
            summary={statistics.currentTray}
          />
        </Section>
        <Section title="Treatment Overall">
          <StatisticsSummaryRows summary={statistics.treatmentOverall} />
        </Section>
        {statistics.recentDays.map((day) => (
          <RecentDaySummary day={day} key={day.dateStart} />
        ))}
      </List>
    </Host>
  );
}
