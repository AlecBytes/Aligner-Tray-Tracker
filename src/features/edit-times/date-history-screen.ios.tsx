import { Button, DisclosureGroup, Host, HStack, Image, List, Section, Spacer, Text } from '@expo/ui/swift-ui';
import { buttonStyle, font, frame, padding } from '@expo/ui/swift-ui/modifiers';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { AppLoadingScreen } from '@/components/app-loading-screen';
import { CenteredState } from '@/components/expo-ui-components';
import {
  buildTreatmentDateHistory,
  type TreatmentHistoryDay,
} from '@/features/edit-times/edit-times-dates';
import { getTreatmentHistoryStart } from '@/features/edit-times/edit-times-repository';
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
  return (
    <Button
      modifiers={[buttonStyle('plain')]}
      onPress={() => router.push({ pathname: '/edit-times/day', params: { date: day.dateKey } })}>
      <HStack
        spacing={8}
        modifiers={[frame({ maxWidth: Infinity, minHeight: 44 }), padding({ vertical: 3 })]}>
        <Text modifiers={[font({ weight: 'semibold' })]}>
          {isToday ? 'Today — ' : ''}
          {dayFormatter.format(day.timestamp)}
        </Text>
        <Spacer />
        <Image color="secondary" size={14} systemName="chevron.right" />
      </HStack>
    </Button>
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

  const refreshHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      setTreatmentStartedAt(await loadHistory());
      setReadAt(Date.now());
      setError(null);
    } catch {
      setError('Date history could not be loaded. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [loadHistory]);

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
      <Host seedColor={theme.primary} style={{ flex: 1 }}>
        <CenteredState
          actionLabel="Try again"
          message={error ?? 'No treatment history was found.'}
          onAction={() => void refreshHistory()}
          title="Date history unavailable"
        />
      </Host>
    );
  }

  const history = buildTreatmentDateHistory(treatmentStartedAt, readAt);

  return (
    <Host seedColor={theme.primary} style={{ flex: 1 }}>
      <List>
        <Section
          footer={<Text>Select a day to review and correct its IN/OUT events.</Text>}
          title="Current Week">
          {history.currentWeekDays.map((day, index) => (
            <DayRow day={day} isToday={index === 0} key={day.dateKey} />
          ))}
        </Section>

        {history.previousWeeks.length > 0 ? (
          <Section title="Previous Weeks">
            {history.previousWeeks.map((week) => {
              const expanded = expandedWeeks.has(week.weekNumber);
              return (
                <DisclosureGroup
                  isExpanded={expanded}
                  key={week.weekNumber}
                  label={`Week ${week.weekNumber} — ${rangeFormatter.format(week.startTimestamp)}–${rangeFormatter.format(week.endTimestamp)}`}
                  onIsExpandedChange={(isExpanded) =>
                    setExpandedWeeks((current) => {
                      const next = new Set(current);
                      if (isExpanded) {
                        next.add(week.weekNumber);
                      } else {
                        next.delete(week.weekNumber);
                      }
                      return next;
                    })
                  }>
                  {expanded
                    ? week.days.map((day) => (
                        <DayRow day={day} isToday={false} key={day.dateKey} />
                      ))
                    : null}
                </DisclosureGroup>
              );
            })}
          </Section>
        ) : null}
      </List>
    </Host>
  );
}
