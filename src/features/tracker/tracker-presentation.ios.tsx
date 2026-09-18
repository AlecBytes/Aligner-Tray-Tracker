import { AppLoadingScreen } from '@/components/app-loading-screen';
import { Button, Host, HStack, Image, RNHostView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  accessibilityHidden,
  accessibilityHint,
  accessibilityLabel,
  aspectRatio,
  background,
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
import { ExperimentalTrayButton } from './experimental-tray-button.ios';
import { ActionButton, CenteredState, isLiquidGlassPlatform, ValidationMessage } from '@/components/expo-ui-components';
import { formatDuration } from '@/features/tracker/tracker-calculations';
import { useTrackerStatusFeedback } from '@/features/tracker/use-tracker-status-feedback.ios';
import { useAppTheme } from '@/theme/use-app-theme';

import type { TrackerPresentationProps } from './tracker-presentation-model';
const trayInImageModule = require('../../../assets/images/tray-in.png');
const trayOutImageModule = require('../../../assets/images/tray-out.png');
const traysImageModule = require('../../../assets/images/trays.png');
const traysImageAspectRatio = 1;

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

export function TrackerPresentation({ status, treatment, retainer, latestPunch, canEdit, canUndo, canRedo, isLoading, isMutating, actionsDisabled, error, needsRetry, refreshTracker, toggleTracker, undoTracker, redoTracker }: TrackerPresentationProps) {
  const router = useRouter();
  const theme = useAppTheme();
  const [trackerAssets] = useAssets([trayInImageModule, trayOutImageModule, traysImageModule]);
  const beginTrackerStatusFeedback = useTrackerStatusFeedback();
  const isIn = status === 'IN';
  const trayImage = trackerAssets?.[isIn ? 0 : 1];
  const currentOutDuration = formatDuration(treatment?.currentOutSeconds ?? 0);
  const daysRemainingLabel = treatment ? `${treatment.daysRemaining} ${Math.abs(treatment.daysRemaining) === 1 ? 'day' : 'days'} left` : '';
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
          {treatment ? <Button
            modifiers={[
              buttonStyle(liquidGlass ? 'glass' : 'bordered'),
              controlSize('large'),
              disabled(actionsDisabled),
              frame({ minWidth: 44, minHeight: 44 }),
              accessibilityLabel('Open treatment plan'),
              accessibilityHint('Opens your treatment plan.'),
            ]}
            onPress={() => router.push('/treatment-plan')}>
            <Image
              uiImage={trackerAssets?.[2]?.localUri ?? undefined}
              modifiers={[
                resizable(),
                aspectRatio({ ratio: traysImageAspectRatio, contentMode: 'fit' }),
                frame({ width: 32, height: 32 }),
                accessibilityHidden(),
              ]}
            />
          </Button> : null}
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

        {retainer ? <VStack spacing={2} modifiers={[frame({ minHeight: 116 })]}>
          <Text modifiers={[font({ textStyle: 'caption', weight: 'semibold' })]}>RETAINER MODE</Text>
          <Text modifiers={[font({ textStyle: 'headline' })]}>{retainer.durationLabel}</Text>
          <Text modifiers={[font({ textStyle: 'largeTitle', weight: 'heavy' }), monospacedDigit(), minimumScaleFactor(0.7), lineLimit(1)]}>{retainer.duration}</Text>
        </VStack> : <VStack spacing={2}>
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
            {treatment!.currentTrayNumber} / {treatment!.totalTrays}
          </Text>
          <Text modifiers={[font({ textStyle: 'headline', weight: 'semibold' })]}>
            Day {treatment!.trayDay}
          </Text>
          <Text
            modifiers={[
              treatment!.daysRemaining < 0
                ? foregroundStyle('red')
                : foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
            ]}>
            {daysRemainingLabel}
          </Text>
        </VStack>}

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
              disabled(actionsDisabled || !canUndo),
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
              disabled(actionsDisabled || !canEdit),
              accessibilityLabel(`Edit last ${latestPunch?.status ?? 'IN or OUT'} time`),
              accessibilityHint('Opens the most recent saved tracker event for correction.'),
            ]}
            onPress={() => {
              if (latestPunch !== null) {
                router.push({
                  pathname: '/edit-times/event',
                  params: { id: String(latestPunch.id), ...(retainer ? { timeline: 'retainer', periodId: String(retainer.periodId) } : {}) },
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
              disabled(actionsDisabled || !canRedo),
              accessibilityLabel('Redo last undone tracker change'),
              accessibilityHint('Restores the most recently undone IN or OUT change.'),
            ]}
            onPress={() => void redoTracker()}
          />
        </HStack>

        <VStack modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, minHeight: 124 })]}>
          <RNHostView>
            <ExperimentalTrayButton
              status={status}
              saving={isMutating}
              disabled={actionsDisabled}
              imageUri={trayImage?.localUri ?? undefined}
              outDuration={currentOutDuration}
              subject={retainer ? 'Retainers' : 'Trays'}
              showDuration={!retainer && !isIn}
              onPress={() => void toggleTracker(beginTrackerStatusFeedback())}
            />
          </RNHostView>
        </VStack>

        {retainer ? <VStack modifiers={[frame({ minHeight: 72, maxWidth: Infinity }), padding({ all: 12 }), background(theme.surface, shapes.roundedRectangle({ cornerRadius: 16 }))]}>
          <Text modifiers={[font({ textStyle: 'headline' })]}>{retainer.reminder}</Text>
        </VStack> : <>        <HStack spacing={10}>
          <TimeMetric
            disabled={actionsDisabled}
            label="IN TODAY"
            onPress={() =>
              router.push({ pathname: '/intervals', params: { highlight: 'IN' } })
            }
            seconds={treatment!.inTodaySeconds}
          />
          <TimeMetric
            disabled={actionsDisabled}
            label="OUT TODAY"
            onPress={() =>
              router.push({ pathname: '/intervals', params: { highlight: 'OUT' } })
            }
            seconds={treatment!.outTodaySeconds}
          />
        </HStack>

        <ActionButton
          disabled={actionsDisabled}
          label="Change tray"
          onPress={() => router.push('/change-tray')}
          prominent={false}
        /></>}
      </VStack>
    </Host>
  );
}

export function TrackerUnavailable({ loading, error, retry }: { loading: boolean; error: string | null; retry: () => Promise<void> }) {
  const theme = useAppTheme();
  if (loading) return <AppLoadingScreen message="Loading tracker…" />;
  return <Host seedColor={theme.primary} style={{ flex: 1 }}><CenteredState title="Tracker unavailable" message={error ?? 'No active tracking was found.'} actionLabel="Try again" onAction={() => void retry()} /></Host>;
}
