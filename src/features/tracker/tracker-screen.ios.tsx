import { Button, Host, HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  accessibilityHint,
  accessibilityLabel,
  background,
  buttonBorderShape,
  buttonStyle,
  contentTransition,
  controlSize,
  disabled,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  minimumScaleFactor,
  monospacedDigit,
  padding,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';

import { AppLoadingScreen } from '@/components/app-loading-screen';
import {
  ActionButton,
  CenteredState,
  isLiquidGlassPlatform,
  ValidationMessage,
} from '@/components/expo-ui-components';
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
import { useAppTheme } from '@/theme/use-app-theme';

function TimeMetric({ label, seconds }: { label: string; seconds: number }) {
  const theme = useAppTheme();
  return (
    <VStack
      alignment="leading"
      spacing={4}
      modifiers={[
        frame({ maxWidth: Infinity, minHeight: 72, alignment: 'leading' }),
        padding({ all: 12 }),
        background(theme.surface, shapes.roundedRectangle({ cornerRadius: 16 })),
      ]}>
      <Text
        modifiers={[
          font({ textStyle: 'caption', weight: 'semibold' }),
          foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
        ]}>
        {label}
      </Text>
      <Text
        modifiers={[
          font({ textStyle: 'title2', weight: 'bold' }),
          monospacedDigit(),
          contentTransition('numericText'),
          minimumScaleFactor(0.7),
          lineLimit(1),
        ]}>
        {formatDuration(seconds)}
      </Text>
    </VStack>
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
        persistedSnapshot === null
          ? 'No active treatment was found. Complete treatment setup first.'
          : null,
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
      <Host seedColor={theme.primary} style={{ flex: 1 }}>
        <CenteredState
          actionLabel="Try again"
          message={error ?? 'No active treatment was found.'}
          onAction={() => void refreshTracker()}
          title="Tracker unavailable"
        />
      </Host>
    );
  }

  const currentSnapshot = snapshot;
  const tracker = createTrackerReadModel(currentSnapshot, now);
  const isIn = tracker.currentStatus === 'IN';
  const daysRemainingLabel = `${tracker.daysRemaining} ${
    tracker.daysRemaining === 1 ? 'day' : 'days'
  } left`;

  async function toggleTracker() {
    if (toggleInProgress.current) {
      return;
    }
    const timestamp = Date.now();
    const persistedStatus = createTrackerReadModel(currentSnapshot, timestamp).currentStatus;
    toggleInProgress.current = true;
    setIsToggling(true);
    setError(null);
    try {
      const punch = await toggleWearStatus(
        db,
        currentSnapshot.trayPeriodId,
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

  const liquidGlass = isLiquidGlassPlatform();

  return (
    <Host seedColor={theme.primary} style={{ flex: 1 }}>
      <VStack
        spacing={10}
        modifiers={[
          frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' }),
          padding({ all: 16 }),
        ]}>
        <HStack>
          <Spacer />
          <Button
            label="Menu"
            systemImage="line.3.horizontal"
            modifiers={[
              buttonStyle(liquidGlass ? 'glass' : 'bordered'),
              controlSize('large'),
              disabled(isToggling),
              accessibilityLabel('Open menu'),
            ]}
            onPress={() => router.push('/menu')}
          />
        </HStack>

        <VStack spacing={2}>
          <Text
            modifiers={[
              font({ textStyle: 'caption', weight: 'semibold' }),
              foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
            ]}>
            TRAY
          </Text>
          <Text
            modifiers={[
              font({ textStyle: 'largeTitle', weight: 'heavy' }),
              monospacedDigit(),
              minimumScaleFactor(0.75),
              lineLimit(1),
            ]}>
            {tracker.currentTrayNumber} / {tracker.totalTrays}
          </Text>
          <Text modifiers={[font({ textStyle: 'headline', weight: 'semibold' })]}>
            Day {tracker.trayDay}
          </Text>
          <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
            {daysRemainingLabel}
          </Text>
        </VStack>

        {error ? <ValidationMessage message={error} /> : null}

        <Button
          modifiers={[
            buttonStyle(
              isIn
                ? liquidGlass
                  ? 'glassProminent'
                  : 'borderedProminent'
                : liquidGlass
                  ? 'glass'
                  : 'bordered',
            ),
            buttonBorderShape('roundedRectangle', 18),
            disabled(isToggling),
            frame({ maxWidth: Infinity, maxHeight: Infinity, minHeight: 124 }),
            accessibilityLabel(
              `Trays are ${isIn ? 'in' : 'out'}. Tap when ${isIn ? 'removed' : 'inserted'}.`,
            ),
            accessibilityHint('Updates the saved IN or OUT state.'),
          ]}
          onPress={() => void toggleTracker()}>
          <VStack
            spacing={8}
            modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, minHeight: 112 })]}>
            <Spacer />
            <Text
              modifiers={[
                font({ textStyle: 'title2', weight: 'bold' }),
                minimumScaleFactor(0.75),
                lineLimit(1),
              ]}>
              {isToggling ? 'SAVING…' : `TRAYS ARE ${tracker.currentStatus}`}
            </Text>
            <Text>{isIn ? 'Tap when removed' : 'Tap when inserted'}</Text>
            <Spacer />
          </VStack>
        </Button>

        <HStack spacing={10}>
          <TimeMetric label="IN TODAY" seconds={tracker.inTodaySeconds} />
          <TimeMetric label="OUT TODAY" seconds={tracker.outTodaySeconds} />
        </HStack>

        <ActionButton
          disabled={isToggling}
          label="Change tray"
          onPress={() => router.push('/change-tray')}
          prominent={false}
        />
      </VStack>
    </Host>
  );
}
