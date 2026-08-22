import { Host, HStack, List, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  accessibilityAddTraits,
  accessibilityLabel,
  background,
  font,
  foregroundStyle,
  frame,
  monospacedDigit,
  padding,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { AppLoadingScreen } from '@/components/app-loading-screen';
import { CenteredState } from '@/components/expo-ui-components';
import type { WearStatus } from '@/db/schema';
import {
  calculateDailyWearIntervals,
  formatDuration,
  getLocalDayStart,
} from '@/features/tracker/tracker-calculations';
import type { DailyWearInterval, TrackerSnapshot } from '@/features/tracker/tracker-model';
import { getTrackerSnapshot } from '@/features/tracker/tracker-repository';
import { useAppTheme } from '@/theme/use-app-theme';

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
});

function firstParameter(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseHighlightedStatus(value: string | string[] | undefined): WearStatus | null {
  const status = firstParameter(value);
  return status === 'IN' || status === 'OUT' ? status : null;
}

function formatIntervalRange(interval: DailyWearInterval) {
  const end = interval.isOngoing ? 'Now' : timeFormatter.format(interval.endedAt);
  return `${timeFormatter.format(interval.startedAt)} – ${end}`;
}

function IntervalRow({
  highlightedStatus,
  interval,
}: {
  highlightedStatus: WearStatus | null;
  interval: DailyWearInterval;
}) {
  const theme = useAppTheme();
  const isHighlighted = interval.status === highlightedStatus;
  const duration = formatDuration(interval.durationSeconds);
  const range = formatIntervalRange(interval);

  return (
    <VStack
      alignment="leading"
      spacing={6}
      modifiers={[
        frame({ maxWidth: Infinity, minHeight: 58, alignment: 'leading' }),
        padding({ all: 10 }),
        background(
          isHighlighted ? theme.primary : theme.surface,
          shapes.roundedRectangle({ cornerRadius: 12 }),
        ),
        accessibilityLabel(
          `${interval.status} interval, ${range}, duration ${duration}${
            isHighlighted ? ', selected' : ''
          }`,
        ),
        ...(isHighlighted ? [accessibilityAddTraits(['isSelected'])] : []),
      ]}>
      <HStack spacing={12}>
        <Text
          modifiers={[
            font({ textStyle: 'headline', weight: 'bold' }),
            ...(isHighlighted ? [foregroundStyle(theme.onPrimary)] : []),
          ]}>
          {interval.status}
        </Text>
        <Spacer />
        <Text
          modifiers={[
            font({ weight: 'semibold' }),
            monospacedDigit(),
            ...(isHighlighted ? [foregroundStyle(theme.onPrimary)] : []),
          ]}>
          {duration}
        </Text>
      </HStack>
      <HStack spacing={12}>
        <Text
          modifiers={[
            isHighlighted
              ? foregroundStyle(theme.onPrimary)
              : foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
          ]}>
          {range}
        </Text>
        <Spacer />
        {isHighlighted ? (
          <Text
            modifiers={[
              font({ textStyle: 'caption', weight: 'semibold' }),
              foregroundStyle(theme.onPrimary),
            ]}>
            Selected
          </Text>
        ) : null}
      </HStack>
    </VStack>
  );
}

export function DailyIntervalsScreen() {
  const db = useSQLiteContext();
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ highlight?: string | string[] }>();
  const highlightedStatus = parseHighlightedStatus(params.highlight);
  const [snapshot, setSnapshot] = useState<TrackerSnapshot | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadIntervals = useCallback(async () => {
    const readAt = Date.now();
    const persistedSnapshot = await getTrackerSnapshot(db, readAt);
    return { persistedSnapshot, readAt };
  }, [db]);

  const refreshIntervals = useCallback(async () => {
    setIsLoading(true);
    try {
      const { persistedSnapshot, readAt } = await loadIntervals();
      setSnapshot(persistedSnapshot);
      setNow(readAt);
      setError(
        persistedSnapshot === null
          ? 'No active treatment was found. Complete treatment setup first.'
          : null,
      );
    } catch {
      setSnapshot(null);
      setError('Today’s intervals could not be loaded. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [loadIntervals]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setIsLoading(true);
      void loadIntervals()
        .then(({ persistedSnapshot, readAt }) => {
          if (!active) {
            return;
          }
          setSnapshot(persistedSnapshot);
          setNow(readAt);
          setError(
            persistedSnapshot === null
              ? 'No active treatment was found. Complete treatment setup first.'
              : null,
          );
        })
        .catch(() => {
          if (active) {
            setSnapshot(null);
            setError('Today’s intervals could not be loaded. Please try again.');
          }
        })
        .finally(() => {
          if (active) {
            setIsLoading(false);
          }
        });

      const timer = setInterval(() => setNow(Date.now()), 1000);
      return () => {
        active = false;
        clearInterval(timer);
      };
    }, [loadIntervals]),
  );

  if (snapshot === null) {
    if (isLoading) {
      return <AppLoadingScreen message="Loading today’s intervals…" />;
    }

    return (
      <Host seedColor={theme.primary} style={{ flex: 1 }}>
        <CenteredState
          actionLabel="Try again"
          message={error ?? 'No active treatment was found.'}
          onAction={() => void refreshIntervals()}
          title="Intervals unavailable"
        />
      </Host>
    );
  }

  const intervals = calculateDailyWearIntervals(
    snapshot.punches,
    getLocalDayStart(now),
    now,
  );
  const sectionTitle = highlightedStatus === null ? 'Today' : `Today — ${highlightedStatus} selected`;

  return (
    <Host seedColor={theme.primary} style={{ flex: 1 }}>
      <List>
        <Section title={sectionTitle}>
          {intervals.length === 0 ? (
            <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
              No IN/OUT intervals were recorded today.
            </Text>
          ) : (
            intervals.map((interval, index) => (
              <IntervalRow
                highlightedStatus={highlightedStatus}
                interval={interval}
                key={`${interval.startedAt}-${interval.status}-${index}`}
              />
            ))
          )}
        </Section>
      </List>
    </Host>
  );
}
