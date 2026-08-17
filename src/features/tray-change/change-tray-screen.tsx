import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppLoadingScreen } from '@/components/app-loading-screen';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { reconcileLocalNotifications } from '@/features/notifications/local-notifications';
import { createTrackerReadModel } from '@/features/tracker/tracker-calculations';
import type { TrackerSnapshot } from '@/features/tracker/tracker-model';
import { getTrackerSnapshot } from '@/features/tracker/tracker-repository';
import { changeTray } from '@/features/tray-change/tray-change-repository';
import {
  getNextTrayNumber,
  getPreviousTrayNumber,
  validateTrayNumber,
} from '@/features/tray-change/change-tray-validation';
import { radius, spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

export function ChangeTrayScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useAppTheme();
  const changeInProgress = useRef(false);
  const [snapshot, setSnapshot] = useState<TrackerSnapshot | null>(null);
  const [readAt, setReadAt] = useState(0);
  const [manualTrayNumber, setManualTrayNumber] = useState('');
  const [pendingTrayNumber, setPendingTrayNumber] = useState<number | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isChanging, setIsChanging] = useState(false);

  const readTracker = useCallback(async () => {
    const timestamp = Date.now();
    const persistedSnapshot = await getTrackerSnapshot(db, timestamp);
    return { persistedSnapshot, timestamp };
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      setIsLoading(true);
      void readTracker()
        .then(({ persistedSnapshot, timestamp }) => {
          if (!active) {
            return;
          }

          setSnapshot(persistedSnapshot);
          setReadAt(timestamp);
          setChangeError(
            persistedSnapshot === null ? 'No active treatment was found.' : null,
          );
        })
        .catch(() => {
          if (active) {
            setChangeError('The current tray could not be loaded.');
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
    }, [readTracker]),
  );

  if (snapshot === null) {
    if (isLoading) {
      return <AppLoadingScreen />;
    }

    return (
      <AppScreen>
        <View style={styles.centeredMessage}>
          <AppText variant="heading">Change tray unavailable</AppText>
          <AppText muted>{changeError ?? 'No active treatment was found.'}</AppText>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={[styles.secondaryButton, { borderColor: theme.border }]}>
            <AppText>Back to tracker</AppText>
          </Pressable>
        </View>
      </AppScreen>
    );
  }

  const tracker = createTrackerReadModel(snapshot, readAt);
  const previousTrayNumber = getPreviousTrayNumber(tracker.currentTrayNumber);
  const nextTrayNumber = getNextTrayNumber(
    tracker.currentTrayNumber,
    tracker.totalTrays,
  );

  function requestTrayChange(trayNumber: number) {
    if (changeInProgress.current) {
      return;
    }

    setPendingTrayNumber(trayNumber);
    setValidationError(null);
    setChangeError(null);
  }

  function requestManualTrayChange() {
    const validation = validateTrayNumber(
      manualTrayNumber,
      tracker.totalTrays,
      tracker.currentTrayNumber,
    );

    if (!validation.success) {
      setValidationError(validation.error);
      setPendingTrayNumber(null);
      return;
    }

    requestTrayChange(validation.data);
  }

  async function confirmTrayChange() {
    if (
      changeInProgress.current ||
      pendingTrayNumber === null ||
      snapshot === null
    ) {
      return;
    }

    changeInProgress.current = true;
    setIsChanging(true);
    setChangeError(null);

    try {
      await changeTray(db, {
        currentTrayPeriodId: snapshot.trayPeriodId,
        trayNumber: pendingTrayNumber,
      });
      void reconcileLocalNotifications(db);
      router.dismissTo('/tracker');
    } catch {
      setChangeError('The tray could not be changed. Your previous tray is unchanged.');
      changeInProgress.current = false;
      setIsChanging(false);
    }
  }

  const confirmationMessage =
    tracker.currentStatus === 'IN'
      ? `Changing trays will mark tray ${tracker.currentTrayNumber} OUT and start tray ${pendingTrayNumber} OUT.`
      : `Your trays are OUT. Start tray ${pendingTrayNumber} now? The new tray will remain OUT until you mark it IN.`;

  return (
    <AppScreen>
      <View style={styles.heading}>
        <AppText muted>
          Current tray: {tracker.currentTrayNumber} / {tracker.totalTrays}
        </AppText>
      </View>

      <View style={styles.adjacentActions}>
        <Pressable
          accessibilityRole="button"
          disabled={previousTrayNumber === null || isChanging}
          onPress={() => {
            if (previousTrayNumber !== null) {
              requestTrayChange(previousTrayNumber);
            }
          }}
          style={({ pressed }) => [
            styles.adjacentButton,
            {
              backgroundColor: pressed ? theme.border : theme.surface,
              borderColor: theme.border,
              opacity: previousTrayNumber === null || isChanging ? 0.45 : 1,
            },
          ]}>
          <AppText>Previous</AppText>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={nextTrayNumber === null || isChanging}
          onPress={() => {
            if (nextTrayNumber !== null) {
              requestTrayChange(nextTrayNumber);
            }
          }}
          style={({ pressed }) => [
            styles.adjacentButton,
            {
              backgroundColor: pressed ? theme.border : theme.surface,
              borderColor: theme.border,
              opacity: nextTrayNumber === null || isChanging ? 0.45 : 1,
            },
          ]}>
          <AppText>Next</AppText>
        </Pressable>
      </View>

      <View style={styles.manualEntry}>
        <AppText>Enter tray number</AppText>
        <View style={styles.manualRow}>
          <TextInput
            accessibilityLabel="Tray number"
            autoCorrect={false}
            editable={!isChanging}
            inputMode="numeric"
            keyboardType="number-pad"
            onChangeText={(value) => {
              setManualTrayNumber(value);
              setValidationError(null);
              setPendingTrayNumber(null);
            }}
            onSubmitEditing={requestManualTrayChange}
            placeholder={`1–${tracker.totalTrays}`}
            placeholderTextColor={theme.textMuted}
            returnKeyType="done"
            selectTextOnFocus
            style={[
              styles.input,
              {
                backgroundColor: theme.surface,
                borderColor: validationError ? theme.error : theme.border,
                color: theme.text,
              },
            ]}
            value={manualTrayNumber}
          />
          <Pressable
            accessibilityRole="button"
            disabled={isChanging}
            onPress={requestManualTrayChange}
            style={({ pressed }) => [
              styles.selectButton,
              {
                backgroundColor: pressed ? theme.primaryPressed : theme.primary,
                opacity: isChanging ? 0.6 : 1,
              },
            ]}>
            <AppText style={{ color: theme.onPrimary, fontWeight: '700' }}>Select</AppText>
          </Pressable>
        </View>
        {validationError ? (
          <AppText accessibilityLiveRegion="polite" style={{ color: theme.error }} variant="caption">
            {validationError}
          </AppText>
        ) : null}
      </View>

      {pendingTrayNumber !== null ? (
        <View
          style={[
            styles.confirmation,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}>
          <AppText variant="heading">Start tray {pendingTrayNumber}?</AppText>
          <AppText muted>{confirmationMessage}</AppText>
          <View style={styles.confirmationActions}>
            <Pressable
              accessibilityRole="button"
              disabled={isChanging}
              onPress={() => {
                setPendingTrayNumber(null);
                setChangeError(null);
              }}
              style={[styles.secondaryButton, { borderColor: theme.border }]}>
              <AppText>Cancel</AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isChanging}
              onPress={() => void confirmTrayChange()}
              style={({ pressed }) => [
                styles.confirmButton,
                {
                  backgroundColor: pressed ? theme.primaryPressed : theme.primary,
                  opacity: isChanging ? 0.6 : 1,
                },
              ]}>
              <AppText style={{ color: theme.onPrimary, fontWeight: '700' }}>
                {isChanging ? 'Changing…' : 'Confirm change'}
              </AppText>
            </Pressable>
          </View>
        </View>
      ) : null}

      {changeError ? (
        <AppText accessibilityLiveRegion="polite" style={{ color: theme.error }}>
          {changeError}
        </AppText>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={isChanging}
        onPress={() => router.dismissTo('/tracker')}
        style={[styles.cancelButton, { borderColor: theme.border }]}>
        <AppText>Back to tracker</AppText>
      </Pressable>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  adjacentActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  adjacentButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  cancelButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 'auto',
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  centeredMessage: {
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
  },
  confirmation: {
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  confirmationActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  confirmButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  heading: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  input: {
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    fontSize: 18,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  manualEntry: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  manualRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  selectButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
});
