import {
  Chart,
  Host,
  HStack,
  Image,
  List,
  Picker,
  ScrollView,
  Section,
  Spacer,
  Text,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  font,
  foregroundStyle,
  frame,
  monospacedDigit,
  pickerStyle,
  tag,
} from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';

import { AppLoadingScreen } from '@/components/app-loading-screen';
import {
  CenteredState,
  MetricRow,
  ValidationMessage,
} from '@/components/expo-ui-components';
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
import { useAppTheme } from '@/theme/use-app-theme';

const SECONDS_PER_HOUR = 60 * 60;
const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;
const MINIMUM_CHART_WIDTH = 320;
const CHART_HEIGHT = 240;

const chartDateFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: '2-digit',
});

const rowDateFormatter = new Intl.DateTimeFormat(undefined, {
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

function StatisticsRangePicker({
  onChange,
  range,
}: {
  onChange: (range: StatisticsGraphRange) => void;
  range: StatisticsGraphRange;
}) {
  return (
    <Picker<StatisticsGraphRange>
      label="Date range"
      modifiers={[pickerStyle('segmented')]}
      onSelectionChange={onChange}
      selection={range}>
      {RANGE_OPTIONS.map((option) => (
        <Text key={option.value} modifiers={[tag(option.value)]}>
          {option.label}
        </Text>
      ))}
    </Picker>
  );
}

function chartWidth(pointCount: number, pointWidth: number) {
  return Math.max(MINIMUM_CHART_WIDTH, pointCount * pointWidth);
}

function WearTimeChart({ points }: { points: DailyStatisticsGraphPoint[] }) {
  return (
    <ScrollView axes="horizontal" showsIndicators>
      <Chart
        animate
        barStyle={{ cornerRadius: 4 }}
        data={points.map((point) => ({
          color: point.goalMet ? 'green' : 'orange',
          x: chartDateFormatter.format(point.dateStart),
          y: point.inSeconds / SECONDS_PER_HOUR,
        }))}
        modifiers={[
          accessibilityLabel('Daily recorded wear hours'),
          frame({ height: CHART_HEIGHT, width: chartWidth(points.length, 44) }),
        ]}
        showGrid
        type="bar"
      />
    </ScrollView>
  );
}

function GoalProgressChart({ points }: { points: DailyStatisticsGraphPoint[] }) {
  const theme = useAppTheme();

  return (
    <ScrollView axes="horizontal" showsIndicators>
      <Chart
        animate
        barStyle={{ cornerRadius: 4 }}
        data={points.map((point) => ({
          color: point.goalMet ? 'green' : 'orange',
          x: chartDateFormatter.format(point.dateStart),
          y: point.goalDifferenceSeconds / SECONDS_PER_HOUR,
        }))}
        modifiers={[
          accessibilityLabel('Daily hours above or below the prescribed goal'),
          frame({ height: CHART_HEIGHT, width: chartWidth(points.length, 44) }),
        ]}
        referenceLines={[{ color: theme.textMuted, x: 'Goal', y: 0 }]}
        ruleStyle={{ dashArray: [5, 4], lineWidth: 1 }}
        showGrid
        type="bar"
      />
    </ScrollView>
  );
}

function TrayProgressChart({ points }: { points: TrayPeriodStatisticsGraphPoint[] }) {
  const theme = useAppTheme();

  return (
    <ScrollView axes="horizontal" showsIndicators>
      <Chart
        animate
        barStyle={{ cornerRadius: 4 }}
        data={points.map((point) => ({
          color: theme.primary,
          x: point.label,
          y: point.durationSeconds / SECONDS_PER_DAY,
        }))}
        modifiers={[
          accessibilityLabel('Elapsed days in each tray period'),
          frame({ height: CHART_HEIGHT, width: chartWidth(points.length, 72) }),
        ]}
        showGrid
        type="bar"
      />
    </ScrollView>
  );
}

function ChartSection({
  graph,
  readModel,
}: {
  graph: StatisticsGraphKind;
  readModel: StatisticsGraphReadModel;
}) {
  const points = graph === 'tray-progress' ? readModel.trayPeriods : readModel.dailyPoints;

  if (points.length === 0) {
    return (
      <Section title="Graph">
        <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
          No graph data is available for this range.
        </Text>
      </Section>
    );
  }

  if (graph === 'wear-time') {
    return (
      <Section title="Recorded Wear Hours">
        <WearTimeChart points={readModel.dailyPoints} />
      </Section>
    );
  }

  if (graph === 'goal-progress') {
    return (
      <Section title="Hours From Goal">
        <GoalProgressChart points={readModel.dailyPoints} />
      </Section>
    );
  }

  return (
    <Section title="Elapsed Days Per Tray Period">
      <TrayProgressChart points={readModel.trayPeriods} />
    </Section>
  );
}

function GoalResult({ point }: { point: DailyStatisticsGraphPoint }) {
  return (
    <HStack spacing={8}>
      <Image
        color={point.goalMet ? 'green' : 'orange'}
        size={16}
        systemName={point.goalMet ? 'checkmark.circle.fill' : 'circle'}
      />
      <Text
        modifiers={[
          font({ weight: 'semibold' }),
          foregroundStyle(point.goalMet ? 'green' : 'orange'),
        ]}>
        {point.goalMet ? 'Goal met' : 'Goal not met'}
      </Text>
    </HStack>
  );
}

function DailyValueSection({
  graph,
  point,
}: {
  graph: Exclude<StatisticsGraphKind, 'tray-progress'>;
  point: DailyStatisticsGraphPoint;
}) {
  return (
    <Section title={rowDateFormatter.format(point.dateStart)}>
      <MetricRow label="Wear time" value={formatStatisticsDuration(point.inSeconds)} />
      <MetricRow label="Prescribed goal" value={formatStatisticsDuration(point.goalSeconds)} />
      {graph === 'wear-time' ? (
        <GoalResult point={point} />
      ) : (
        <HStack>
          <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
            Result
          </Text>
          <Spacer />
          <Text modifiers={[font({ weight: 'semibold' }), monospacedDigit()]}>
            {formatStatisticsGoalDifference(point.goalDifferenceSeconds)}
          </Text>
        </HStack>
      )}
    </Section>
  );
}

function TrayValueSection({ point }: { point: TrayPeriodStatisticsGraphPoint }) {
  return (
    <Section
      header={
        <HStack>
          <Text modifiers={[font({ weight: 'semibold' })]}>{point.label}</Text>
          <Spacer />
          {point.isActive ? (
            <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
              Current
            </Text>
          ) : null}
        </HStack>
      }>
      <MetricRow label="Duration" value={formatStatisticsTrayDuration(point.durationSeconds)} />
      <MetricRow label="From" value={dateTimeFormatter.format(point.startedAt)} />
      <MetricRow label="Through" value={dateTimeFormatter.format(point.endedAt)} />
    </Section>
  );
}

function ExactValues({
  graph,
  readModel,
}: {
  graph: StatisticsGraphKind;
  readModel: StatisticsGraphReadModel;
}) {
  if (graph === 'tray-progress') {
    return readModel.trayPeriods
      .slice()
      .reverse()
      .map((point) => <TrayValueSection key={point.id} point={point} />);
  }

  return readModel.dailyPoints
    .slice()
    .reverse()
    .map((point) => (
      <DailyValueSection graph={graph} key={point.dateStart} point={point} />
    ));
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
      <Host seedColor={theme.primary} style={{ flex: 1 }}>
        <CenteredState
          actionLabel="Try again"
          message={error ?? 'No treatment history was found.'}
          onAction={() => void refresh()}
          title="Graph unavailable"
        />
      </Host>
    );
  }

  return (
    <Host seedColor={theme.primary} style={{ flex: 1 }}>
      <List>
        <Section>
          <StatisticsRangePicker onChange={setRange} range={range} />
          {error ? <ValidationMessage message={error} /> : null}
        </Section>
        <ChartSection graph={graph} readModel={readModel} />
        <ExactValues graph={graph} readModel={readModel} />
      </List>
    </Host>
  );
}

export function StatisticsGraphDetailScreen({
  graph,
}: {
  graph: StatisticsGraphKind | null;
}) {
  const theme = useAppTheme();

  if (graph === null) {
    return (
      <Host seedColor={theme.primary} style={{ flex: 1 }}>
        <CenteredState
          message="This graph type is not available."
          title="Graph unavailable"
        />
      </Host>
    );
  }

  return <ValidStatisticsGraphDetailScreen graph={graph} />;
}
