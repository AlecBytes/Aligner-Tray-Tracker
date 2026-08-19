import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppLoadingScreen } from '@/components/app-loading-screen';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import {
  addLocalDays,
  formatLocalTime,
  parseLocalDateKey,
} from '@/features/edit-times/edit-times-dates';
import type { EditableWearPunch } from '@/features/edit-times/edit-times-model';
import { getWearPunchesForDay } from '@/features/edit-times/edit-times-repository';
import { radius, spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

const headingFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'long',
  weekday: 'long',
});
function firstParameter(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function DailyPunchHistoryScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ date?: string | string[] }>();
  const dateKey = firstParameter(params.date);
  const dayStart = dateKey ? parseLocalDateKey(dateKey) : null;
  const [punches, setPunches] = useState<EditableWearPunch[]>([]);
  const [isLoading, setIsLoading] = useState(dayStart !== null);
  const [error, setError] = useState<string | null>(null);

  const loadPunches = useCallback(async () => {
    if (dayStart === null) {
      throw new Error('Invalid date.');
    }
    return getWearPunchesForDay(db, dayStart, addLocalDays(dayStart, 1));
  }, [dayStart, db]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      if (dayStart === null) {
        setError('This date is invalid. Return to date history and select a day.');
        setIsLoading(false);
        return () => {
          active = false;
        };
      }

      setIsLoading(true);
      void loadPunches()
        .then((savedPunches) => {
          if (active) {
            setPunches(savedPunches);
            setError(null);
          }
        })
        .catch(() => {
          if (active) {
            setError('Punch history could not be loaded. Please try again.');
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
    }, [dayStart, loadPunches]),
  );

  if (isLoading) {
    return <AppLoadingScreen message="Loading punch history…" />;
  }

  const title = dayStart === null ? 'Punch History' : headingFormatter.format(dayStart);

  return (
    <AppScreen scrollable>
      <Stack.Screen options={{ title }} />
      <AppText variant="heading">{title}</AppText>

      {error ? (
        <AppText accessibilityLiveRegion="polite" style={{ color: theme.error }}>
          {error}
        </AppText>
      ) : null}

      {punches.length === 0 && !error ? (
        <AppText muted>No IN/OUT events were recorded on this day.</AppText>
      ) : (
        <View style={styles.punches}>
          {punches.map((punch) => (
            <Pressable
              accessibilityRole="button"
              key={punch.id}
              onPress={() =>
                router.push({
                  pathname: '/edit-times/event',
                  params: { id: String(punch.id) },
                })
              }
              style={({ pressed }) => [
                styles.punch,
                {
                  backgroundColor: pressed ? theme.border : theme.surface,
                  borderColor: theme.border,
                },
              ]}>
              <AppText style={styles.time}>{formatLocalTime(punch.timestamp)}</AppText>
              <AppText style={[styles.status, { color: theme.primary }]}>{punch.status}</AppText>
              <AppText muted>›</AppText>
            </Pressable>
          ))}
        </View>
      )}

      {dayStart !== null && dateKey ? (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({ pathname: '/edit-times/add', params: { date: dateKey } })
          }
          style={({ pressed }) => [
            styles.addButton,
            {
              backgroundColor: pressed ? theme.primaryPressed : theme.primary,
            },
          ]}>
          <AppText style={{ color: theme.onPrimary, fontWeight: '700' }}>
            + Add Missing Time
          </AppText>
        </Pressable>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  addButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    justifyContent: 'center',
    marginTop: spacing.sm,
    minHeight: 54,
    paddingHorizontal: spacing.lg,
  },
  punch: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.md,
  },
  punches: {
    gap: spacing.sm,
  },
  status: {
    fontWeight: '800',
    width: 40,
  },
  time: {
    flex: 1,
    fontVariant: ['tabular-nums'],
  },
});
