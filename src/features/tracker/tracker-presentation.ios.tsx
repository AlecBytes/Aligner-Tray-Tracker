import { AppLoadingScreen } from '@/components/app-loading-screen';
import { ActionButton, CenteredState, isLiquidGlassPlatform, ValidationMessage } from '@/components/expo-ui-components';
import { formatDuration } from '@/features/tracker/tracker-calculations';
import { useTrackerStatusFeedback } from '@/features/tracker/use-tracker-status-feedback.ios';
import { isSupportEnabled } from '@/config/support-config';
import { useAppTheme } from '@/theme/use-app-theme';
import { trackerStatusControlStyle } from '../../../modules/tracker-status-control';
import { Button, Host, HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
    accessibilityHidden,
    accessibilityHint,
    accessibilityLabel,
    accessibilityValue,
    aspectRatio,
    background,
    buttonStyle,
    contentTransition,
    controlSize,
    disabled,
    font,
    foregroundStyle,
    frame,
    labelStyle,
    lineLimit,
    minimumScaleFactor,
    monospacedDigit,
    opacity,
    padding,
    resizable,
    shapes,
} from '@expo/ui/swift-ui/modifiers';
import { useAssets } from 'expo-asset';
import { useRouter } from 'expo-router';

import type { TrackerPresentationProps } from './tracker-presentation-model';
const trayInImageModule = require('../../../assets/images/tray-in.png');
const trayOutImageModule = require('../../../assets/images/tray-out.png');
const trayInImageAspectRatio = 1448 / 1086;
const trayOutImageAspectRatio = 1188 / 681;

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
        testID={`tracker-time-metric-${label.startsWith('IN') ? 'in' : 'out'}`}
        alignment="leading"
        spacing={4}
        modifiers={[
          frame({ maxWidth: Infinity, minHeight: 56, alignment: 'leading' }),
          padding({ horizontal: 12, vertical: 8 }),
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

function HelpButton({ liquidGlass, onPress }: { liquidGlass: boolean; onPress: () => void }) {
  return (
    <Button
      modifiers={[
        buttonStyle(liquidGlass ? 'glass' : 'bordered'),
        controlSize('large'),
        frame({ minWidth: 44, minHeight: 44 }),
        accessibilityLabel('Open help'),
        accessibilityHint('Opens help for using Aligner Tracker.'),
      ]}
      onPress={onPress}>
      <HStack spacing={6}>
        <Image size={24} systemName="questionmark.circle" />
        <Text>Help</Text>
      </HStack>
    </Button>
  );
}

function SupportButton({ liquidGlass, onPress }: { liquidGlass: boolean; onPress: () => void }) {
  return (
    <Button
      modifiers={[
        buttonStyle(liquidGlass ? 'glass' : 'bordered'),
        controlSize('large'),
        frame({ minWidth: 44, minHeight: 44 }),
        accessibilityLabel('Support Aligner Tracker'),
        accessibilityHint('Opens Support Aligner Tracker.'),
      ]}
      onPress={onPress}>
      <Image
        size={24}
        systemName="heart"
        modifiers={[accessibilityHidden()]}
      />
    </Button>
  );
}

export function TrackerPresentation({ status, treatment, retainer, latestPunch, canEdit, canUndo, canRedo, isLoading, isMutating, actionsDisabled, error, needsRetry, refreshTracker, toggleTracker, undoTracker, redoTracker }: TrackerPresentationProps) {
  const router = useRouter();
  const theme = useAppTheme();
  const [trackerAssets] = useAssets([trayInImageModule, trayOutImageModule]);
  const beginTrackerStatusFeedback = useTrackerStatusFeedback();
  const isIn = status === 'IN';
  const trayImage = trackerAssets?.[isIn ? 0 : 1];
  const trayImageAspectRatio = isIn ? trayInImageAspectRatio : trayOutImageAspectRatio;
  const currentOutDuration = formatDuration(treatment?.currentOutSeconds ?? 0);
  const daysRemainingLabel = treatment ? `${treatment.daysRemaining} ${Math.abs(treatment.daysRemaining) === 1 ? 'day' : 'days'} left` : '';
  const liquidGlass = isLiquidGlassPlatform();
  const trackerSubject = retainer ? 'Retainers' : 'Trays';

  return (
    <Host seedColor={theme.primary} style={{ flex: 1 }}>
      <VStack
        spacing={10}
        modifiers={[
          frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' }),
          padding({ all: 16 }),
        ]}>
        <HStack testID="tracker-compact-header" alignment="top" spacing={8}>
          <VStack
            alignment="leading"
            modifiers={[frame({ maxWidth: Infinity, alignment: 'topLeading' })]}>
            <Button
              label="Notifications"
              systemImage="bell"
              modifiers={[
                buttonStyle(liquidGlass ? 'glass' : 'bordered'),
                controlSize('large'),
                disabled(actionsDisabled),
                labelStyle('iconOnly'),
                frame({ minWidth: 44, minHeight: 44 }),
                accessibilityLabel('Open notifications'),
                accessibilityHint('Opens notification settings.'),
              ]}
              onPress={() => router.push('/notifications')}
            />
          </VStack>

          {retainer ? (
            <VStack
              spacing={2}
              modifiers={[frame({ maxWidth: Infinity, minHeight: 116, alignment: 'top' })]}>
              <Text modifiers={[font({ textStyle: 'caption', weight: 'semibold' })]}>
                RETAINER MODE
              </Text>
              <Text
                modifiers={[
                  font({ textStyle: 'headline' }),
                  minimumScaleFactor(0.7),
                  lineLimit(1),
                ]}>
                {retainer.durationLabel}
              </Text>
              <Text
                modifiers={[
                  font({ textStyle: 'largeTitle', weight: 'heavy' }),
                  monospacedDigit(),
                  minimumScaleFactor(0.7),
                  lineLimit(1),
                ]}>
                {retainer.duration}
              </Text>
            </VStack>
          ) : (
            <VStack
              spacing={2}
              modifiers={[frame({ maxWidth: Infinity, minHeight: 116, alignment: 'top' })]}>
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
              <Text
                modifiers={[
                  font({ textStyle: 'headline', weight: 'semibold' }),
                  minimumScaleFactor(0.75),
                  lineLimit(1),
                ]}>
                Day {treatment!.trayDay}
              </Text>
              <Text
                modifiers={[
                  minimumScaleFactor(0.75),
                  lineLimit(1),
                  treatment!.daysRemaining < 0
                    ? foregroundStyle('red')
                    : foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                ]}>
                {daysRemainingLabel}
              </Text>
            </VStack>
          )}

          <VStack
            alignment="trailing"
            modifiers={[frame({ maxWidth: Infinity, alignment: 'topTrailing' })]}>
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
          </VStack>
        </HStack>

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

        <Button
          testID="tracker-toggle-button"
          modifiers={[
            trackerStatusControlStyle({
              faceColor: isIn ? theme.primary : theme.surface,
              baseColor: isIn ? theme.primaryPressed : theme.border,
              foregroundColor: isIn ? theme.onPrimary : theme.text,
            }),
            disabled(actionsDisabled),
            frame({ maxWidth: Infinity, maxHeight: Infinity, minHeight: 124 }),
            accessibilityLabel(trackerSubject),
            accessibilityValue(`${status}${isMutating ? ', saving' : ''}`),
            accessibilityHint(
              isMutating
                ? 'Saving the tracker change.'
                : `Tap when ${trackerSubject.toLowerCase()} are ${isIn ? 'removed' : 'inserted'}.`,
            ),
          ]}
          onPress={() => void toggleTracker(beginTrackerStatusFeedback())}>
          <VStack
            spacing={8}
            modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, minHeight: 112 })]}>
            <Spacer />
            {trayImage?.localUri ? (
              <Image
                uiImage={trayImage.localUri}
                modifiers={[
                  resizable(),
                  aspectRatio({ ratio: trayImageAspectRatio, contentMode: 'fit' }),
                  frame({ width: 260, height: 195 }),
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
              {`${trackerSubject.toUpperCase()} ARE ${status}`}
            </Text>
            {!retainer ? (
              <Text
                modifiers={[
                  font({ textStyle: 'title', weight: 'bold' }),
                  monospacedDigit(),
                  contentTransition('numericText'),
                  minimumScaleFactor(0.75),
                  lineLimit(1),
                  opacity(isIn ? 0 : 1),
                  accessibilityHidden(isIn),
                ]}>
                {currentOutDuration}
              </Text>
            ) : null}
            <Text>{isMutating ? 'Saving…' : isIn ? 'Tap when removed' : 'Tap when inserted'}</Text>
            <Spacer />
          </VStack>
        </Button>

        {retainer ? (
          <HStack testID="tracker-bottom-actions" spacing={10}>
            <VStack
              modifiers={[
                frame({ minHeight: 72, maxWidth: Infinity }),
                padding({ all: 12 }),
                background(theme.surface, shapes.roundedRectangle({ cornerRadius: 16 })),
              ]}>
              <Text modifiers={[font({ textStyle: 'headline' })]}>{retainer.reminder}</Text>
            </VStack>
            {isSupportEnabled ? (
              <SupportButton liquidGlass={liquidGlass} onPress={() => router.push('/support')} />
            ) : null}
            <HelpButton liquidGlass={liquidGlass} onPress={() => router.push('/help')} />
          </HStack>
        ) : (
          <>
            <HStack spacing={10}>
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

            <HStack testID="tracker-bottom-actions" spacing={10}>
              <ActionButton
                disabled={actionsDisabled}
                label="Change tray"
                onPress={() => router.push('/change-tray')}
                prominent={false}
              />
              {isSupportEnabled ? (
                <SupportButton liquidGlass={liquidGlass} onPress={() => router.push('/support')} />
              ) : null}
              <HelpButton liquidGlass={liquidGlass} onPress={() => router.push('/help')} />
            </HStack>
          </>
        )}
      </VStack>
    </Host>
  );
}

export function TrackerUnavailable({ loading, error, retry }: { loading: boolean; error: string | null; retry: () => Promise<void> }) {
  const theme = useAppTheme();
  if (loading) return <AppLoadingScreen message="Loading tracker…" />;
  return <Host seedColor={theme.primary} style={{ flex: 1 }}><CenteredState title="Tracker unavailable" message={error ?? 'No active tracking was found.'} actionLabel="Try again" onAction={() => void retry()} /></Host>;
}
