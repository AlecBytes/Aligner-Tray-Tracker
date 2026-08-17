import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppLoadingScreen } from '@/components/app-loading-screen';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import {
  buildTreatmentDateHistory,
  type TreatmentHistoryDay,
  type TreatmentHistoryWeek,
} from '@/features/edit-times/edit-times-dates';
import { getTreatmentHistoryStart } from '@/features/edit-times/edit-times-repository';
import { radius, spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

const dayFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  weekday: 'short',
});
const rangeFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
});

function DayRow({ day, isToday }: { day: TreatmentHistoryDay; isToday: boolean }) {
  const router = useRouter();
  const theme = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.push({ pathname: '/edit-times/day', params: { date: day.dateKey } })
      }
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? theme.border : theme.surface,
          borderColor: theme.border,
        },
      ]}>
      <AppText style={styles.rowLabel}>
        {isToday ? 'Today — ' : ''}{dayFormatter.format(day.timestamp)}
      </AppText>
      <AppText muted>›</AppText>
    </Pressable>
  );
}

function WeekRow({
  expanded,
  onToggle,
  week,
}: {
  expanded: boolean;
  onToggle: () => void;
  week: TreatmentHistoryWeek;
}) {
  const theme = useAppTheme();

  return (
    <View style={styles.week}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: pressed ? theme.border : theme.surface,
            borderColor: theme.border,
          },
        ]}>
        <AppText style={styles.rowLabel}>
          Week {week.weekNumber} — {rangeFormatter.format(week.startTimestamp)}–{rangeFormatter.format(week.endTimestamp)}
        </AppText>
        <AppText muted>{expanded ? '⌃' : '⌄'}</AppText>
      </Pressable>
      {expanded ? (
        <View style={styles.expandedDays}>
          {week.days.map((day) => <DayRow day={day} isToday={false} key={day.dateKey} />)}
        </View>
      ) : null}
    </View>
  );
}

export function DateHistoryScreen() {
  const db = useSQLiteContext();
  const theme = useAppTheme();
  const [treatmentStartedAt, setTreatmentStartedAt] = useState<number | null>(null);
  const [readAt, setReadAt] = useState(() => Date.now());
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(() => new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    const start = await getTreatmentHistoryStart(db);

    if (start === null) {
      throw new Error('No treatment history exists.');
    }

    return start;
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setIsLoading(true);

      void loadHistory()
        .then((start) => {
          if (active) {
            setTreatmentStartedAt(start);
            setReadAt(Date.now());
            setError(null);
          }
        })
        .catch(() => {
          if (active) {
            setError('Date history could not be loaded. Please try again.');
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

  if (isLoading && treatmentStartedAt === null) {
    return <AppLoadingScreen message="Loading date history…" />;
  }

  if (treatmentStartedAt === null) {
    return (
      <AppScreen>
        <View style={styles.message}>
          <AppText variant="heading">Date history unavailable</AppText>
          <AppText muted>{error ?? 'No treatment history was found.'}</AppText>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setIsLoading(true);
              void loadHistory()
                .then((start) => {
                  setTreatmentStartedAt(start);
                  setReadAt(Date.now());
                  setError(null);
                })
                .catch(() => setError('Date history could not be loaded. Please try again.'))
                .finally(() => setIsLoading(false));
            }}
            style={[styles.retryButton, { borderColor: theme.border }]}>
            <AppText>Try again</AppText>
          </Pressable>
        </View>
      </AppScreen>
    );
  }

  const history = buildTreatmentDateHistory(treatmentStartedAt, readAt);

  return (
    <AppScreen>
      <AppText muted>Select a day to review and correct its IN/OUT events.</AppText>

      <View style={styles.days}>
        {history.currentWeekDays.map((day, index) => (
          <DayRow day={day} isToday={index === 0} key={day.dateKey} />
        ))}
      </View>

      {history.previousWeeks.length > 0 ? (
        <View style={styles.previousWeeks}>
          <AppText variant="heading">Previous Weeks</AppText>
          {history.previousWeeks.map((week) => (
            <WeekRow
              expanded={expandedWeeks.has(week.weekNumber)}
              key={week.weekNumber}
              onToggle={() =>
                setExpandedWeeks((current) => {
                  const next = new Set(current);
                  if (next.has(week.weekNumber)) {
                    next.delete(week.weekNumber);
                  } else {
                    next.add(week.weekNumber);
                  }
                  return next;
                })
              }
              week={week}
            />
          ))}
        </View>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  days: {
    gap: spacing.sm,
  },
  expandedDays: {
    gap: spacing.sm,
    paddingLeft: spacing.md,
  },
  message: {
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
  },
  previousWeeks: {
    gap: spacing.md,
    paddingTop: spacing.md,
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
  row: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 54,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowLabel: {
    flex: 1,
    fontWeight: '700',
  },
  week: {
    gap: spacing.sm,
  },
});
