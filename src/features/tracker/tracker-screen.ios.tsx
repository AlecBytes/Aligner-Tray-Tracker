import { Button, Host, HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  accessibilityHidden,
  accessibilityHint,
  accessibilityLabel,
  aspectRatio,
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
  resizable,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { useAssets } from 'expo-asset';
import { useRouter } from 'expo-router';
import { AppLoadingScreen } from '@/components/app-loading-screen';
import { ActionButton, CenteredState, isLiquidGlassPlatform, ValidationMessage } from '@/components/expo-ui-components';
import { createTrackerReadModel, formatDuration, getLatestWearPunch } from '@/features/tracker/tracker-calculations';
import { useIOSTracker } from '@/features/tracker/use-ios-tracker';
import { useAppTheme } from '@/theme/use-app-theme';

const alignerImageModule = require('../../../assets/images/clear-aligner.png');
const alignerImageAspectRatio = 1194 / 697;

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
  const router = useRouter();
  const theme = useAppTheme();
  const [alignerAssets] = useAssets(alignerImageModule);
  const {
    snapshot, history, now, isLoading, isMutating, error, needsRetry, actionsDisabled,
    refreshTracker, toggleTracker, undoTracker, redoTracker,
  } = useIOSTracker();

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
    Math.abs(tracker.daysRemaining) === 1 ? 'day' : 'days'
  } left`;

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
              disabled(actionsDisabled),
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
          <Text
            modifiers={[
              tracker.daysRemaining < 0
                ? foregroundStyle('red')
                : foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
            ]}>
            {daysRemainingLabel}
          </Text>
        </VStack>

        {error ? <ValidationMessage message={error} /> : null}
        {needsRetry ? (
          <Button label="Retry" modifiers={[disabled(isLoading || isMutating)]}
            onPress={() => void refreshTracker()} />
        ) : null}

        <HStack spacing={8}>
          <Button
            label="Undo"
            systemImage="arrow.uturn.backward"
            modifiers={[
              buttonStyle(liquidGlass ? 'glass' : 'bordered'),
              controlSize('small'),
              disabled(actionsDisabled || history.undoAction === null),
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
              disabled(actionsDisabled || latestPunch === null),
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
              disabled(actionsDisabled || history.redoAction === null),
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
            disabled(actionsDisabled),
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
            {alignerAssets?.[0]?.localUri ? (
              <Image
                uiImage={alignerAssets[0].localUri}
                modifiers={[
                  resizable(),
                  aspectRatio({ ratio: alignerImageAspectRatio, contentMode: 'fit' }),
                  frame({ maxWidth: 180, maxHeight: 105 }),
                  accessibilityHidden(),
                ]}
              />
            ) : null}
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
            disabled={actionsDisabled}
            label="IN TODAY"
            onPress={() =>
              router.push({ pathname: '/intervals', params: { highlight: 'IN' } })
            }
            seconds={tracker.inTodaySeconds}
          />
          <TimeMetric
            disabled={actionsDisabled}
            label="OUT TODAY"
            onPress={() =>
              router.push({ pathname: '/intervals', params: { highlight: 'OUT' } })
            }
            seconds={tracker.outTodaySeconds}
          />
        </HStack>

        <ActionButton
          disabled={actionsDisabled}
          label="Change tray"
          onPress={() => router.push('/change-tray')}
          prominent={false}
        />
      </VStack>
    </Host>
  );
}
