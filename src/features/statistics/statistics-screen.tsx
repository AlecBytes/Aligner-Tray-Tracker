import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppLoadingScreen } from '@/components/app-loading-screen';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
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
import { radius, spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  weekday: 'short',
});

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricRow}>
      <AppText muted style={styles.metricLabel}>{label}</AppText>
      <AppText style={styles.metricValue}>{value}</AppText>
    </View>
  );
}

function SummaryCard({
  daysWorn,
  summary,
}: {
  daysWorn?: number;
  summary: StatisticsSummary;
}) {
  const theme = useAppTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {daysWorn === undefined ? null : (
        <MetricRow label="Days worn" value={String(daysWorn)} />
      )}
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
    </View>
  );
}

function RecentDayCard({ day }: { day: RecentTreatmentDay }) {
  const theme = useAppTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.dayHeading}>
        <AppText style={styles.dayDate}>{dateFormatter.format(day.dateStart)}</AppText>
        <AppText muted={!day.goalMet} style={styles.goalResult} variant="caption">
          {day.goalMet ? 'Goal met' : 'Goal not met'}
        </AppText>
      </View>
      <MetricRow label="IN" value={formatStatisticsDuration(day.inSeconds)} />
      <MetricRow label="OUT" value={formatStatisticsDuration(day.outSeconds)} />
    </View>
  );
}

export function StatisticsScreen() {
  const db = useSQLiteContext();
  const theme = useAppTheme();
  const [statistics, setStatistics] = useState<StatisticsReadModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStatistics = useCallback(async () => {
    const readAt = Date.now();
    const snapshot = await getStatisticsSnapshot(db);

    if (snapshot === null) {
      throw new Error('No active treatment history exists.');
    }

    return createStatisticsReadModel(snapshot, readAt);
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
      <AppScreen>
        <View style={styles.message}>
          <AppText variant="heading">Statistics unavailable</AppText>
          <AppText muted>{error ?? 'No treatment history was found.'}</AppText>
          <Pressable
            accessibilityRole="button"
            onPress={() => void refreshStatistics()}
            style={({ pressed }) => [
              styles.retryButton,
              {
                backgroundColor: pressed ? theme.border : theme.surface,
                borderColor: theme.border,
              },
            ]}>
            <AppText>Try again</AppText>
          </Pressable>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      {error ? (
        <AppText accessibilityLiveRegion="polite" style={{ color: theme.error }}>
          {error}
        </AppText>
      ) : null}

      <View style={styles.section}>
        <AppText muted style={styles.sectionLabel} variant="caption">CURRENT TRAY</AppText>
        <SummaryCard daysWorn={statistics.currentTray.daysWorn} summary={statistics.currentTray} />
      </View>

      <View style={styles.section}>
        <AppText muted style={styles.sectionLabel} variant="caption">TREATMENT OVERALL</AppText>
        <SummaryCard summary={statistics.treatmentOverall} />
      </View>

      <View style={styles.section}>
        <AppText muted style={styles.sectionLabel} variant="caption">RECENT DAYS</AppText>
        <View style={styles.recentDays}>
          {statistics.recentDays.map((day) => (
            <RecentDayCard day={day} key={day.dateStart} />
          ))}
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    padding: spacing.lg,
  },
  dayDate: {
    fontWeight: '700',
  },
  dayHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  goalResult: {
    fontWeight: '700',
  },
  message: {
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
  },
  metricLabel: {
    flex: 1,
  },
  metricRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  metricValue: {
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    textAlign: 'right',
  },
  recentDays: {
    gap: spacing.sm,
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
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    fontWeight: '700',
    letterSpacing: 1,
  },
});
