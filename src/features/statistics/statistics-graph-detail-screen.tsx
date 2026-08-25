import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppLoadingScreen } from '@/components/app-loading-screen';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import {
  formatStatisticsDuration,
  formatStatisticsGoalDifference,
  formatStatisticsTrayDuration,
} from '@/features/statistics/statistics-calculations';
import type {
  DailyStatisticsGraphPoint,
  StatisticsGraphKind,
  StatisticsGraphRange,
  StatisticsGraphReadModel,
  TrayPeriodStatisticsGraphPoint,
} from '@/features/statistics/statistics-model';
import { useStatisticsGraph } from '@/features/statistics/use-statistics-graph';
import { radius, spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  month: 'short',
});

const RANGE_OPTIONS: { label: string; value: StatisticsGraphRange }[] = [
  { label: '7 Days', value: '7-days' },
  { label: '30 Days', value: '30-days' },
  { label: 'Treatment', value: 'treatment' },
];

function RangeControl({
  onChange,
  range,
}: {
  onChange: (range: StatisticsGraphRange) => void;
  range: StatisticsGraphRange;
}) {
  const theme = useAppTheme();

  return (
    <View accessibilityRole="radiogroup" style={styles.rangeControl}>
      {RANGE_OPTIONS.map((option) => {
        const selected = option.value === range;
        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[
              styles.rangeButton,
              {
                backgroundColor: selected ? theme.primary : theme.surface,
                borderColor: selected ? theme.primary : theme.border,
              },
            ]}>
            <AppText style={{ color: selected ? theme.onPrimary : theme.text }}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function DailyPointCard({
  graph,
  point,
}: {
  graph: Exclude<StatisticsGraphKind, 'tray-progress'>;
  point: DailyStatisticsGraphPoint;
}) {
  return (
    <View style={styles.card}>
      <AppText style={styles.cardTitle}>{dateFormatter.format(point.dateStart)}</AppText>
      <AppText>Wear time: {formatStatisticsDuration(point.inSeconds)}</AppText>
      <AppText>Goal: {formatStatisticsDuration(point.goalSeconds)}</AppText>
      <AppText muted={!point.goalMet}>
        {graph === 'wear-time'
          ? point.goalMet
            ? 'Goal met'
            : 'Goal not met'
          : formatStatisticsGoalDifference(point.goalDifferenceSeconds)}
      </AppText>
    </View>
  );
}

function TrayPeriodCard({ point }: { point: TrayPeriodStatisticsGraphPoint }) {
  return (
    <View style={styles.card}>
      <AppText style={styles.cardTitle}>
        {point.label}{point.isActive ? ' · Current' : ''}
      </AppText>
      <AppText>Duration: {formatStatisticsTrayDuration(point.durationSeconds)}</AppText>
      <AppText>From: {dateTimeFormatter.format(point.startedAt)}</AppText>
      <AppText>Through: {dateTimeFormatter.format(point.endedAt)}</AppText>
    </View>
  );
}

function GraphValues({
  graph,
  readModel,
}: {
  graph: StatisticsGraphKind;
  readModel: StatisticsGraphReadModel;
}) {
  const points = graph === 'tray-progress' ? readModel.trayPeriods : readModel.dailyPoints;

  if (points.length === 0) {
    return <AppText muted>No graph data is available for this range.</AppText>;
  }

  return (
    <View style={styles.values}>
      {graph === 'tray-progress'
        ? readModel.trayPeriods
            .slice()
            .reverse()
            .map((point) => <TrayPeriodCard key={point.id} point={point} />)
        : readModel.dailyPoints
            .slice()
            .reverse()
            .map((point) => <DailyPointCard graph={graph} key={point.dateStart} point={point} />)}
    </View>
  );
}

function ValidStatisticsGraphDetailScreen({ graph }: { graph: StatisticsGraphKind }) {
  const [range, setRange] = useState<StatisticsGraphRange>('7-days');
  const { error, graph: readModel, isLoading, refresh } = useStatisticsGraph(range);
  const theme = useAppTheme();

  if (readModel === null) {
    if (isLoading) {
      return <AppLoadingScreen message="Loading graph…" />;
    }

    return (
      <AppScreen scrollable>
        <View style={styles.message}>
          <AppText variant="heading">Graph unavailable</AppText>
          <AppText muted>{error ?? 'No treatment history was found.'}</AppText>
          <Pressable
            accessibilityRole="button"
            onPress={() => void refresh()}
            style={[styles.retryButton, { borderColor: theme.border }]}>
            <AppText>Try again</AppText>
          </Pressable>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen scrollable>
      <RangeControl onChange={setRange} range={range} />
      {error ? <AppText style={{ color: theme.error }}>{error}</AppText> : null}
      <AppText muted>
        Charts are available on iOS. Exact values for the selected range are shown below.
      </AppText>
      <GraphValues graph={graph} readModel={readModel} />
    </AppScreen>
  );
}

export function StatisticsGraphDetailScreen({
  graph,
}: {
  graph: StatisticsGraphKind | null;
}) {
  if (graph === null) {
    return (
      <AppScreen scrollable={false}>
        <View style={styles.message}>
          <AppText variant="heading">Graph unavailable</AppText>
          <AppText muted>This graph type is not available.</AppText>
        </View>
      </AppScreen>
    );
  }

  return <ValidStatisticsGraphDetailScreen graph={graph} />;
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  cardTitle: {
    fontWeight: '700',
  },
  message: {
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
  },
  rangeButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  rangeControl: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  retryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  values: {
    gap: spacing.lg,
  },
});
