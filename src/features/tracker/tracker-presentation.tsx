import { AppLoadingScreen } from '@/components/app-loading-screen';
import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { radius, spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';
import { formatDuration } from './tracker-calculations';
import type { TrackerPresentationProps } from './tracker-presentation-model';

const trayInImageSource = require('../../../assets/images/tray-in.png');
const trayOutImageSource = require('../../../assets/images/tray-out.png');

type TimeMetricProps = {
  disabled: boolean;
  label: string;
  onPress: () => void;
  seconds: number;
};

function TimeMetric({ disabled, label, onPress, seconds }: TimeMetricProps) {
  const theme = useAppTheme();
  const duration = formatDuration(seconds);

  return (
    <Pressable
      accessibilityHint={`Opens today’s intervals with ${label.startsWith('IN') ? 'IN' : 'OUT'} selected.`}
      accessibilityLabel={`${label}, ${duration}`}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.metric,
        {
          backgroundColor: pressed ? theme.border : theme.surface,
          borderColor: theme.border,
          opacity: disabled ? 0.6 : 1,
        },
      ]}>
      <AppText muted style={styles.metricLabel} variant="caption">
        {label}
      </AppText>
      <AppText style={styles.duration}>{duration}</AppText>
    </Pressable>
  );
}

export function TrackerPresentation({ status, treatment, retainer, latestPunch, canEdit, canUndo, canRedo, isLoading, isMutating, actionsDisabled, error, needsRetry, refreshTracker, toggleTracker, undoTracker, redoTracker }: TrackerPresentationProps) {
  const router = useRouter();
  const theme = useAppTheme();
  const isIn = status === 'IN';
  const currentOutDuration = formatDuration(treatment?.currentOutSeconds ?? 0);
  const daysRemainingLabel = treatment ? `${treatment.daysRemaining} ${Math.abs(treatment.daysRemaining) === 1 ? 'day' : 'days'} left` : '';
  return (
    <AppScreen contentStyle={styles.screenContent} scrollable={false}>
      <View style={styles.topActions}>
        <Pressable
          accessibilityLabel="Open menu"
          accessibilityRole="button"
          disabled={actionsDisabled}
          onPress={() => router.push('/menu')}
          style={({ pressed }) => [
            styles.menuButton,
            {
              backgroundColor: pressed ? theme.border : theme.surface,
              borderColor: theme.border,
              opacity: isMutating ? 0.6 : 1,
            },
          ]}>
          <AppText style={styles.menuButtonLabel}>Menu</AppText>
        </Pressable>
      </View>

      {retainer ? <View style={[styles.traySummary, { minHeight: 116 }]}>
        <AppText muted variant="caption">RETAINER MODE</AppText>
        <AppText variant="heading">{retainer.durationLabel}</AppText>
        <AppText style={styles.duration}>{retainer.duration}</AppText>
      </View> : <View style={styles.traySummary}>
        <AppText muted style={styles.sectionLabel} variant="caption">
          TRAY
        </AppText>
        <AppText style={styles.trayNumber}>
          {treatment!.currentTrayNumber} / {treatment!.totalTrays}
        </AppText>
        <AppText variant="heading">Day {treatment!.trayDay}</AppText>
        <AppText muted style={treatment!.daysRemaining < 0 ? { color: theme.error } : undefined}>
          {daysRemainingLabel}
        </AppText>
      </View>}

      {error ? (
        <AppText accessibilityLiveRegion="polite" style={{ color: theme.error }}>
          {error}
        </AppText>
      ) : null}

      {needsRetry ? <Pressable accessibilityRole="button" disabled={isMutating || isLoading} onPress={() => void refreshTracker()}><AppText>Retry</AppText></Pressable> : null}

      <Pressable
        accessibilityLabel={
          retainer ? `Retainers are ${status}. Tap when ${isIn ? 'removed' : 'inserted'}.` : isIn
            ? 'Trays are in. Tap when removed.'
            : `Trays are out for ${currentOutDuration}. Tap when inserted.`
        }
        accessibilityRole="button"
        disabled={actionsDisabled}
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
            opacity: isMutating ? 0.65 : 1,
          },
        ]}>
        <Image
          accessible={false}
          resizeMode="contain"
          source={isIn ? trayInImageSource : trayOutImageSource}
          style={styles.toggleAlignerImage}
        />
        <AppText
          style={[styles.toggleLabel, { color: isIn ? theme.onPrimary : theme.primary }]}
          variant="heading">
          {isMutating ? 'SAVING…' : `${retainer ? 'RETAINERS' : 'TRAYS'} ARE ${status}`}
        </AppText>
        <AppText
          accessible={!retainer && !isIn}
          style={[
            styles.outDuration,
            { color: theme.primary, opacity: retainer || isIn ? 0 : 1 },
          ]}>
          {currentOutDuration}
        </AppText>
        <AppText style={{ color: isIn ? theme.onPrimary : theme.textMuted }}>
          {isIn ? 'Tap when removed' : 'Tap when inserted'}
        </AppText>
      </Pressable>

      <View style={styles.historyActions}>
        <Pressable
          accessibilityLabel="Undo last tracker change"
          accessibilityRole="button"
          disabled={actionsDisabled || !canUndo}
          onPress={() => void undoTracker()}
          style={({ pressed }) => [
            styles.historyActionButton,
            {
              backgroundColor: pressed ? theme.border : theme.surface,
              borderColor: theme.border,
              opacity: isMutating || !canUndo ? 0.6 : 1,
            },
          ]}>
          <AppText style={styles.historyActionButtonLabel}>↶ Undo</AppText>
        </Pressable>

        <Pressable
          accessibilityLabel={`Edit last ${latestPunch?.status ?? 'IN or OUT'} time`}
          accessibilityRole="button"
          disabled={actionsDisabled || !canEdit}
          onPress={() => {
            if (latestPunch !== null) {
              router.push({
                pathname: '/edit-times/event',
                params: { id: String(latestPunch.id), ...(retainer ? { timeline: 'retainer', periodId: String(retainer.periodId) } : {}) },
              });
            }
          }}
          style={({ pressed }) => [
            styles.historyActionButton,
            {
              backgroundColor: pressed ? theme.border : theme.surface,
              borderColor: theme.border,
              opacity: actionsDisabled || !canEdit ? 0.6 : 1,
            },
          ]}>
          <AppText style={styles.historyActionButtonLabel}>Edit last</AppText>
        </Pressable>

        <Pressable
          accessibilityLabel="Redo last undone tracker change"
          accessibilityRole="button"
          disabled={actionsDisabled || !canRedo}
          onPress={() => void redoTracker()}
          style={({ pressed }) => [
            styles.historyActionButton,
            {
              backgroundColor: pressed ? theme.border : theme.surface,
              borderColor: theme.border,
              opacity: isMutating || !canRedo ? 0.6 : 1,
            },
          ]}>
          <AppText style={styles.historyActionButtonLabel}>Redo ↷</AppText>
        </Pressable>
      </View>

      {retainer ? <View style={[styles.metric, { flex: 0, minHeight: 72 }]}><AppText variant="heading">{retainer.reminder}</AppText></View> : <>      <View style={styles.metrics}>
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
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={actionsDisabled}
        onPress={() => router.push('/change-tray')}
        style={({ pressed }) => [
          styles.changeTrayButton,
          {
            backgroundColor: pressed ? theme.border : theme.surface,
            borderColor: theme.border,
            opacity: isMutating ? 0.6 : 1,
          },
        ]}>
        <AppText style={{ fontWeight: '700' }}>Change tray</AppText>
      </Pressable></>}
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
  historyActionButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: spacing.xs,
  },
  historyActionButtonLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  historyActions: {
    flexDirection: 'row',
    gap: spacing.xs,
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
  outDuration: {
    fontSize: 30,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    letterSpacing: 0.5,
    lineHeight: 38,
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
    flex: 1,
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 120,
    padding: spacing.lg,
  },
  toggleAlignerImage: {
    flexShrink: 1,
    height: 195,
    maxWidth: 260,
    width: '75%',
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

export function TrackerUnavailable({ loading, error, retry }: { loading: boolean; error: string | null; retry: () => Promise<void> }) {
  if (loading) return <AppLoadingScreen message="Loading tracker…" />;
  return <AppScreen scrollable={false}><View style={styles.message}><AppText variant="heading">Tracker unavailable</AppText><AppText>{error ?? 'No active tracking was found.'}</AppText><Pressable accessibilityRole="button" onPress={() => void retry()} style={styles.retryButton}><AppText>Try again</AppText></Pressable></View></AppScreen>;
}
