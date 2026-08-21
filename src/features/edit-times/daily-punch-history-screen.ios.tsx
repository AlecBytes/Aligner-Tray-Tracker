import { Host, List, Section, Text } from '@expo/ui/swift-ui';
import { foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { AppLoadingScreen } from '@/components/app-loading-screen';
import {
  ActionButton,
  NavigationRow,
  ValidationMessage,
} from '@/components/expo-ui-components';
import {
  addLocalDays,
  formatLocalTime,
  parseLocalDateKey,
} from '@/features/edit-times/edit-times-dates';
import type { EditableWearPunch } from '@/features/edit-times/edit-times-model';
import { getWearPunchesForDay } from '@/features/edit-times/edit-times-repository';
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
    <>
      <Stack.Screen options={{ title }} />
      <Host seedColor={theme.primary} style={{ flex: 1 }}>
        <List>
          {error ? (
            <Section>
              <ValidationMessage message={error} />
            </Section>
          ) : null}

          <Section title={title}>
            {punches.length === 0 && !error ? (
              <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
                No IN/OUT events were recorded on this day.
              </Text>
            ) : (
              punches.map((punch) => (
                <NavigationRow
                  key={punch.id}
                  label={formatLocalTime(punch.timestamp)}
                  onPress={() =>
                    router.push({
                      pathname: '/edit-times/event',
                      params: { id: String(punch.id) },
                    })
                  }
                  secondaryValue={punch.status}
                />
              ))
            )}
          </Section>

          {dayStart !== null && dateKey ? (
            <Section>
              <ActionButton
                label="Add Missing Time"
                onPress={() =>
                  router.push({ pathname: '/edit-times/add', params: { date: dateKey } })
                }
                systemImage="plus"
              />
            </Section>
          ) : null}
        </List>
      </Host>
    </>
  );
}
