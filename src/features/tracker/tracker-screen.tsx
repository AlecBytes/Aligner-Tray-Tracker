import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppLoadingScreen } from '@/components/app-loading-screen';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { reconcileLocalNotifications } from '@/features/notifications/local-notifications';
import {
  createTrackerReadModel,
  formatDuration,
} from '@/features/tracker/tracker-calculations';
import type { TrackerSnapshot } from '@/features/tracker/tracker-model';
import {
  getTrackerSnapshot,
  toggleWearStatus,
} from '@/features/tracker/tracker-repository';
import { radius, spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

type TimeMetricProps = {
  label: string;
  seconds: number;
};

function TimeMetric({ label, seconds }: TimeMetricProps) {
  const theme = useAppTheme();

  return (
    <View style={[styles.metric, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <AppText muted style={styles.metricLabel} variant="caption">
        {label}
      </AppText>
      <AppText style={styles.duration}>{formatDuration(seconds)}</AppText>
    </View>
  );
}

export function TrackerScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useAppTheme();
  const toggleInProgress = useRef(false);
  const [snapshot, setSnapshot] = useState<TrackerSnapshot | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readPersistedTracker = useCallback(async () => {
    const readAt = Date.now();
    const persistedSnapshot = await getTrackerSnapshot(db, readAt);
    return { persistedSnapshot, readAt };
  }, [db]);

  const refreshTracker = useCallback(async () => {
    setIsLoading(true);

    try {
      const { persistedSnapshot, readAt } = await readPersistedTracker();
      setSnapshot(persistedSnapshot);
      setNow(readAt);
      setError(
        persistedSnapshot === null ? 'No active treatment was found. Complete treatment setup first.' : null,
      );
    } catch {
      setError('The saved tracker could not be loaded. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [readPersistedTracker]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      setIsLoading(true);
      void readPersistedTracker()
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
            setError('The saved tracker could not be loaded. Please try again.');
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
    }, [readPersistedTracker]),
  );

  if (snapshot === null) {
    if (isLoading) {
      return <AppLoadingScreen message="Loading tracker…" />;
    }

    return (
      <AppScreen scrollable={false}>
        <View style={styles.message}>
          <AppText variant="heading">Tracker unavailable</AppText>
          <AppText muted>{error ?? 'No active treatment was found.'}</AppText>
          <Pressable
            accessibilityRole="button"
            onPress={() => void refreshTracker()}
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

  const tracker = createTrackerReadModel(snapshot, now);
  const isIn = tracker.currentStatus === 'IN';
  const daysRemainingLabel = `${tracker.daysRemaining} ${
    tracker.daysRemaining === 1 ? 'day' : 'days'
  } left`;

  async function toggleTracker() {
    if (toggleInProgress.current || snapshot === null) {
      return;
    }

    const timestamp = Date.now();
    const persistedStatus = createTrackerReadModel(snapshot, timestamp).currentStatus;
    toggleInProgress.current = true;
    setIsToggling(true);
    setError(null);

    try {
      const punch = await toggleWearStatus(
        db,
        snapshot.trayPeriodId,
        persistedStatus,
        timestamp,
      );

      setSnapshot((currentSnapshot) =>
        currentSnapshot === null
          ? currentSnapshot
          : { ...currentSnapshot, punches: [...currentSnapshot.punches, punch] },
      );
      setNow(timestamp);
      void reconcileLocalNotifications(db);
    } catch {
      setError('The tracker could not be updated. Showing the last saved state.');

      try {
        const { persistedSnapshot, readAt } = await readPersistedTracker();
        setSnapshot(persistedSnapshot);
        setNow(readAt);
      } catch {
        // Keep the last successfully loaded state visible.
      }
    } finally {
      toggleInProgress.current = false;
      setIsToggling(false);
    }
  }

  return (
    <AppScreen contentStyle={styles.screenContent} scrollable={false}>
      <View style={styles.topActions}>
        <Pressable
          accessibilityLabel="Open menu"
          accessibilityRole="button"
          disabled={isToggling}
          onPress={() => router.push('/menu')}
          style={({ pressed }) => [
            styles.menuButton,
            {
              backgroundColor: pressed ? theme.border : theme.surface,
              borderColor: theme.border,
              opacity: isToggling ? 0.6 : 1,
            },
          ]}>
          <AppText style={styles.menuButtonLabel}>Menu</AppText>
        </Pressable>
      </View>

      <View style={styles.traySummary}>
        <AppText muted style={styles.sectionLabel} variant="caption">
          TRAY
        </AppText>
        <AppText style={styles.trayNumber}>
          {tracker.currentTrayNumber} / {tracker.totalTrays}
        </AppText>
        <AppText variant="heading">Day {tracker.trayDay}</AppText>
        <AppText muted>{daysRemainingLabel}</AppText>
      </View>

      <View style={styles.metrics}>
        <TimeMetric label="IN TODAY" seconds={tracker.inTodaySeconds} />
        <TimeMetric label="OUT TODAY" seconds={tracker.outTodaySeconds} />
      </View>

      {error ? (
        <AppText accessibilityLiveRegion="polite" style={{ color: theme.error }}>
          {error}
        </AppText>
      ) : null}

      <Pressable
        accessibilityLabel={`Trays are ${isIn ? 'in' : 'out'}. Tap when ${
          isIn ? 'removed' : 'inserted'
        }.`}
        accessibilityRole="button"
        disabled={isToggling}
        onPress={() => void toggleTracker()}
        style={({ pressed }) => [
          styles.toggleButton,
          {
            backgroundColor: isIn
              ? pressed
                ? theme.primaryPressed
                : theme.primary
              : pressed
                ? theme.border
                : theme.surface,
            borderColor: theme.primary,
            opacity: isToggling ? 0.65 : 1,
          },
        ]}>
        <AppText
          style={[styles.toggleLabel, { color: isIn ? theme.onPrimary : theme.primary }]}
          variant="heading">
          {isToggling ? 'SAVING…' : `TRAYS ARE ${tracker.currentStatus}`}
        </AppText>
        <AppText style={{ color: isIn ? theme.onPrimary : theme.textMuted }}>
          {isIn ? 'Tap when removed' : 'Tap when inserted'}
        </AppText>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        disabled={isToggling}
        onPress={() => router.push('/change-tray')}
        style={({ pressed }) => [
          styles.changeTrayButton,
          {
            backgroundColor: pressed ? theme.border : theme.surface,
            borderColor: theme.border,
            opacity: isToggling ? 0.6 : 1,
          },
        ]}>
        <AppText style={{ fontWeight: '700' }}>Change tray</AppText>
      </Pressable>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  changeTrayButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  duration: {
    fontSize: 30,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    letterSpacing: 0.5,
    lineHeight: 38,
  },
  message: {
    gap: spacing.md,
    justifyContent: 'center',
    flex: 1,
  },
  menuButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  menuButtonLabel: {
    fontWeight: '700',
  },
  metric: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  metricLabel: {
    fontWeight: '700',
    letterSpacing: 1,
  },
  metrics: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  retryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  sectionLabel: {
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  toggleButton: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 2,
    gap: spacing.sm,
    justifyContent: 'center',
    flexGrow: 1,
    marginTop: 'auto',
    maxHeight: 180,
    minHeight: 120,
    padding: spacing.lg,
  },
  toggleLabel: {
    textAlign: 'center',
  },
  topActions: {
    alignItems: 'flex-end',
  },
  screenContent: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  trayNumber: {
    fontSize: 44,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 52,
  },
  traySummary: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
});
