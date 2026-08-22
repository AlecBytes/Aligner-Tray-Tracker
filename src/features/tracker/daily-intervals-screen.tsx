import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppLoadingScreen } from '@/components/app-loading-screen';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import type { WearStatus } from '@/db/schema';
import {
  calculateDailyWearIntervals,
  formatDuration,
  getLocalDayStart,
} from '@/features/tracker/tracker-calculations';
import type { DailyWearInterval, TrackerSnapshot } from '@/features/tracker/tracker-model';
import { getTrackerSnapshot } from '@/features/tracker/tracker-repository';
import { radius, spacing } from '@/theme/tokens';
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
  const foregroundColor = isHighlighted ? theme.onPrimary : theme.text;
  const secondaryColor = isHighlighted ? theme.onPrimary : theme.textMuted;

  return (
    <View
      accessibilityLabel={`${interval.status} interval, ${range}, duration ${duration}`}
      accessibilityState={{ selected: isHighlighted }}
      accessible
      style={[
        styles.interval,
        {
          backgroundColor: isHighlighted ? theme.primary : theme.surface,
          borderColor: isHighlighted ? theme.primary : theme.border,
        },
      ]}>
      <View style={styles.intervalHeading}>
        <AppText style={[styles.status, { color: foregroundColor }]}>{interval.status}</AppText>
        <AppText style={[styles.duration, { color: foregroundColor }]}>{duration}</AppText>
      </View>
      <View style={styles.intervalDetails}>
        <AppText style={{ color: secondaryColor }}>{range}</AppText>
        {isHighlighted ? (
          <AppText style={[styles.selectedLabel, { color: theme.onPrimary }]}>Selected</AppText>
        ) : null}
      </View>
    </View>
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
      <AppScreen scrollable={false}>
        <View style={styles.message}>
          <AppText variant="heading">Intervals unavailable</AppText>
          <AppText muted>{error ?? 'No active treatment was found.'}</AppText>
          <Pressable
            accessibilityRole="button"
            onPress={() => void refreshIntervals()}
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

  const intervals = calculateDailyWearIntervals(
    snapshot.punches,
    getLocalDayStart(now),
    now,
  );

  return (
    <AppScreen scrollable>
      <AppText muted variant="caption">
        {highlightedStatus === null ? 'TODAY' : `TODAY — ${highlightedStatus} SELECTED`}
      </AppText>
      {intervals.length === 0 ? (
        <AppText muted>No IN/OUT intervals were recorded today.</AppText>
      ) : (
        <View style={styles.intervals}>
          {intervals.map((interval, index) => (
            <IntervalRow
              highlightedStatus={highlightedStatus}
              interval={interval}
              key={`${interval.startedAt}-${interval.status}-${index}`}
            />
          ))}
        </View>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  duration: {
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
  interval: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    minHeight: 76,
    padding: spacing.md,
  },
  intervalDetails: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  intervalHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  intervals: {
    gap: spacing.sm,
  },
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
  selectedLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  status: {
    fontSize: 17,
    fontWeight: '800',
  },
});
