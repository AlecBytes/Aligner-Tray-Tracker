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
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { AppLoadingScreen } from '@/components/app-loading-screen';
import {
  ActionButton,
  CenteredState,
  isLiquidGlassPlatform,
  ValidationMessage,
} from '@/components/expo-ui-components';
import { reconcileLocalNotifications } from '@/features/notifications/local-notifications';
import {
  addWearStatusChangedListener,
  ensureWearStatus,
  isNativeWearStatusAvailable,
} from '@/features/siri/aligner-tracker-intents';
import {
  createTrackerReadModel,
  formatDuration,
  getLatestWearPunch,
} from '@/features/tracker/tracker-calculations';
import { subscribeToTrackerExternalChanges } from '@/features/tracker/tracker-external-refresh';
import {
  applyTrackerRedo,
  applyTrackerUndo,
  getTrackerSessionHistory,
  rememberTrackerRedo,
  rememberTrackerToggle,
  rememberTrackerUndo,
  validateTrackerSessionHistory,
} from '@/features/tracker/tracker-history-session';
import type { TrackerSnapshot } from '@/features/tracker/tracker-model';
import {
  getTrackerSnapshot,
  redoWearStatus,
  toggleWearStatus,
  undoWearStatus,
} from '@/features/tracker/tracker-repository';
import { useAppTheme } from '@/theme/use-app-theme';

function TimeMetric({
  disabled: isDisabled,
  label,
  onPress,
  seconds,
}: {
  disabled: boolean;
  label: string;
  onPress: () => void;
  seconds: number;
}) {
  const theme = useAppTheme();
  const duration = formatDuration(seconds);

  return (
    <Button
      modifiers={[
        buttonStyle('plain'),
        disabled(isDisabled),
        frame({ maxWidth: Infinity }),
        accessibilityLabel(`${label}, ${duration}`),
        accessibilityHint(
          `Opens today’s intervals with ${label.startsWith('IN') ? 'IN' : 'OUT'} selected.`,
        ),
      ]}
      onPress={onPress}>
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
          {duration}
        </Text>
      </VStack>
    </Button>
  );
}

export function TrackerScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useAppTheme();
  const mutationInProgress = useRef(false);
  const [snapshot, setSnapshot] = useState<TrackerSnapshot | null>(null);
  const [history, setHistory] = useState(getTrackerSessionHistory);
  const [now, setNow] = useState(() => Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
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
      setHistory(validateTrackerSessionHistory(persistedSnapshot));
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

  const refreshExternalTracker = useCallback(async () => {
    try {
      const { persistedSnapshot, readAt } = await readPersistedTracker();
      setSnapshot(persistedSnapshot);
      setHistory(validateTrackerSessionHistory(persistedSnapshot));
      setNow(readAt);
      setError(
        persistedSnapshot === null
          ? 'No active treatment was found. Complete treatment setup first.'
          : null,
      );
    } catch {
      setError('The saved tracker could not be loaded. Please try again.');
    }
  }, [readPersistedTracker]);

  useEffect(() => {
    const subscription = subscribeToTrackerExternalChanges({
      addWearStatusListener: addWearStatusChangedListener,
      appState: AppState,
      refresh() {
        void refreshExternalTracker();
      },
    });

    return () => {
      subscription.remove();
    };
  }, [refreshExternalTracker]);

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
          setHistory(validateTrackerSessionHistory(persistedSnapshot));
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
  const latestPunch = getLatestWearPunch(currentSnapshot.punches);
  const isIn = tracker.currentStatus === 'IN';
  const currentOutDuration = formatDuration(tracker.currentOutSeconds);
  const daysRemainingLabel = `${tracker.daysRemaining} ${
    tracker.daysRemaining === 1 ? 'day' : 'days'
  } left`;

  async function toggleTracker() {
    if (mutationInProgress.current || latestPunch === null) {
      return;
    }
    const timestamp = Date.now();
    const persistedStatus = createTrackerReadModel(currentSnapshot, timestamp).currentStatus;
    mutationInProgress.current = true;
    setIsMutating(true);
    setError(null);
    try {
      const desiredStatus = persistedStatus === 'IN' ? 'OUT' : 'IN';
      const nativeWearStatusAvailable = isNativeWearStatusAvailable();
      const result = nativeWearStatusAvailable
        ? await ensureWearStatus(desiredStatus, timestamp)
        : {
            notificationStatus: 'not-needed' as const,
            outcome: 'changed' as const,
            punch: await toggleWearStatus(
              db,
              currentSnapshot.trayPeriodId,
              persistedStatus,
              timestamp,
            ),
          };
      if (result.outcome !== 'changed') {
        throw new Error('The saved tracker state changed before the action completed.');
      }
      const punch = result.punch;
      setSnapshot((currentSnapshot) =>
        currentSnapshot === null
          ? currentSnapshot
          : { ...currentSnapshot, punches: [...currentSnapshot.punches, punch] },
      );
      setHistory(
        rememberTrackerToggle({
          predecessor: latestPunch,
          punch,
          trayPeriodId: currentSnapshot.trayPeriodId,
        }),
      );
      setNow(timestamp);
      if (result.notificationStatus === 'failed') {
        setError('Tracker saved, but reminders could not be refreshed.');
      } else if (!nativeWearStatusAvailable) {
        void reconcileLocalNotifications(db);
      }
    } catch {
      setError('The tracker could not be updated. Showing the last saved state.');
      try {
        const { persistedSnapshot, readAt } = await readPersistedTracker();
        setSnapshot(persistedSnapshot);
        setHistory(validateTrackerSessionHistory(persistedSnapshot));
        setNow(readAt);
      } catch {
        // Keep the last successfully loaded state visible.
      }
    } finally {
      mutationInProgress.current = false;
      setIsMutating(false);
    }
  }

  async function undoTracker() {
    const action = history.undoAction;

    if (mutationInProgress.current || action === null) {
      return;
    }

    mutationInProgress.current = true;
    setIsMutating(true);
    setError(null);

    try {
      await undoWearStatus(db, action);
      setSnapshot((currentSnapshot) =>
        currentSnapshot === null ? currentSnapshot : applyTrackerUndo(currentSnapshot, action),
      );
      setHistory(rememberTrackerUndo(action));
      setNow(Date.now());
      void reconcileLocalNotifications(db);
    } catch {
      setError('The tracker change could not be undone. Showing the last saved state.');
      try {
        const { persistedSnapshot, readAt } = await readPersistedTracker();
        setSnapshot(persistedSnapshot);
        setHistory(validateTrackerSessionHistory(persistedSnapshot));
        setNow(readAt);
      } catch {
        // Keep the last successfully loaded state visible.
      }
    } finally {
      mutationInProgress.current = false;
      setIsMutating(false);
    }
  }

  async function redoTracker() {
    const action = history.redoAction;

    if (mutationInProgress.current || action === null) {
      return;
    }

    mutationInProgress.current = true;
    setIsMutating(true);
    setError(null);

    try {
      const restoredPunch = await redoWearStatus(db, action);
      setSnapshot((currentSnapshot) =>
        currentSnapshot === null
          ? currentSnapshot
          : applyTrackerRedo(currentSnapshot, restoredPunch),
      );
      setHistory(rememberTrackerRedo(restoredPunch));
      setNow(Date.now());
      void reconcileLocalNotifications(db);
    } catch {
      setError('The tracker change could not be redone. Showing the last saved state.');
      try {
        const { persistedSnapshot, readAt } = await readPersistedTracker();
        setSnapshot(persistedSnapshot);
        setHistory(validateTrackerSessionHistory(persistedSnapshot));
        setNow(readAt);
      } catch {
        // Keep the last successfully loaded state visible.
      }
    } finally {
      mutationInProgress.current = false;
      setIsMutating(false);
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
              disabled(isMutating),
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

        <HStack spacing={8}>
          <Button
            label="Undo"
            systemImage="arrow.uturn.backward"
            modifiers={[
              buttonStyle(liquidGlass ? 'glass' : 'bordered'),
              controlSize('small'),
              disabled(isMutating || history.undoAction === null),
              accessibilityLabel('Undo last tracker change'),
              accessibilityHint('Removes the most recent IN or OUT change made on this screen.'),
            ]}
            onPress={() => void undoTracker()}
          />
          <Spacer />
          <Button
            label="Edit last"
            modifiers={[
              buttonStyle(liquidGlass ? 'glass' : 'bordered'),
              controlSize('small'),
              disabled(isMutating || latestPunch === null),
              accessibilityLabel(`Edit last ${latestPunch?.status ?? 'IN or OUT'} time`),
              accessibilityHint('Opens the most recent saved tracker event for correction.'),
            ]}
            onPress={() => {
              if (latestPunch !== null) {
                router.push({
                  pathname: '/edit-times/event',
                  params: { id: String(latestPunch.id) },
                });
              }
            }}
          />
          <Spacer />
          <Button
            label="Redo"
            systemImage="arrow.uturn.forward"
            modifiers={[
              buttonStyle(liquidGlass ? 'glass' : 'bordered'),
              controlSize('small'),
              disabled(isMutating || history.redoAction === null),
              accessibilityLabel('Redo last undone tracker change'),
              accessibilityHint('Restores the most recently undone IN or OUT change.'),
            ]}
            onPress={() => void redoTracker()}
          />
        </HStack>

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
            disabled(isMutating),
            frame({ maxWidth: Infinity, maxHeight: Infinity, minHeight: 124 }),
            accessibilityLabel(
              isIn
                ? 'Trays are in. Tap when removed.'
                : `Trays are out for ${currentOutDuration}. Tap when inserted.`,
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
              {isMutating ? 'SAVING…' : `TRAYS ARE ${tracker.currentStatus}`}
            </Text>
            {!isIn ? (
              <Text
                modifiers={[
                  font({ textStyle: 'title', weight: 'bold' }),
                  monospacedDigit(),
                  contentTransition('numericText'),
                  minimumScaleFactor(0.75),
                  lineLimit(1),
                ]}>
                {currentOutDuration}
              </Text>
            ) : null}
            <Text>{isIn ? 'Tap when removed' : 'Tap when inserted'}</Text>
            <Spacer />
          </VStack>
        </Button>

        <HStack spacing={10}>
          <TimeMetric
            disabled={isMutating}
            label="IN TODAY"
            onPress={() =>
              router.push({ pathname: '/intervals', params: { highlight: 'IN' } })
            }
            seconds={tracker.inTodaySeconds}
          />
          <TimeMetric
            disabled={isMutating}
            label="OUT TODAY"
            onPress={() =>
              router.push({ pathname: '/intervals', params: { highlight: 'OUT' } })
            }
            seconds={tracker.outTodaySeconds}
          />
        </HStack>

        <ActionButton
          disabled={isMutating}
          label="Change tray"
          onPress={() => router.push('/change-tray')}
          prominent={false}
        />
      </VStack>
    </Host>
  );
}
