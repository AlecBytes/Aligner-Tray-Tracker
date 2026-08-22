import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppLoadingScreen } from '@/components/app-loading-screen';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { useFormKeyboardNavigation } from '@/components/form-keyboard-navigation';
import { DateTimeFields } from '@/features/edit-times/date-time-fields';
import { CorrectionValidationError } from '@/features/edit-times/edit-times-corrections';
import { getWearPunchDeletionConfirmation } from '@/features/edit-times/edit-times-deletion';
import {
  formatLocalDateKey,
  formatLocalTime,
  parseLocalDateTime,
} from '@/features/edit-times/edit-times-dates';
import type {
  EditableWearPunch,
  WearPunchDeletionPlan,
} from '@/features/edit-times/edit-times-model';
import {
  CorrectionConflictError,
  deleteWearPunch,
  getWearPunchForEdit,
  updateWearPunchTimestamp,
} from '@/features/edit-times/edit-times-repository';
import { reconcileLocalNotifications } from '@/features/notifications/local-notifications';
import { radius, spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

function firstParameter(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function knownCorrectionMessage(error: unknown) {
  return error instanceof CorrectionValidationError || error instanceof CorrectionConflictError
    ? error.message
    : 'The correction could not be saved. Your previous history is unchanged.';
}

export function EditEventScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useAppTheme();
  const keyboardNavigation = useFormKeyboardNavigation(2, 'edit-event-keyboard');
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const idValue = firstParameter(params.id);
  const punchId = idValue && /^\d+$/.test(idValue) ? Number(idValue) : null;
  const mutationInProgress = useRef(false);
  const [punch, setPunch] = useState<EditableWearPunch | null>(null);
  const [deletionPlan, setDeletionPlan] = useState<WearPunchDeletionPlan | null>(null);
  const [dateValue, setDateValue] = useState('');
  const [timeValue, setTimeValue] = useState('');
  const [isLoading, setIsLoading] = useState(punchId !== null);
  const [pendingAction, setPendingAction] = useState<'delete' | 'save' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPunch = useCallback(async () => {
    if (punchId === null || !Number.isSafeInteger(punchId)) {
      throw new Error('Invalid punch.');
    }
    return getWearPunchForEdit(db, punchId);
  }, [db, punchId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setIsLoading(true);

      void loadPunch()
        .then((savedPunch) => {
          if (!active) {
            return;
          }

          if (savedPunch === null) {
            setPunch(null);
            setDeletionPlan(null);
            setError('This punch no longer exists.');
            return;
          }

          setPunch(savedPunch.punch);
          setDeletionPlan(savedPunch.deletionPlan);
          setDateValue(formatLocalDateKey(savedPunch.punch.timestamp));
          setTimeValue(formatLocalTime(savedPunch.punch.timestamp));
          setError(null);
        })
        .catch(() => {
          if (active) {
            setError('The punch could not be loaded. Return to punch history and try again.');
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
    }, [loadPunch]),
  );

  async function saveCorrection() {
    if (mutationInProgress.current || punch === null) {
      return;
    }

    const timestamp = parseLocalDateTime(dateValue, timeValue);

    if (timestamp === null) {
      setError('Enter a valid date and time using YYYY-MM-DD and h:mm AM/PM.');
      requestAnimationFrame(() => keyboardNavigation.focusField(0));
      return;
    }

    mutationInProgress.current = true;
    setPendingAction('save');
    setError(null);

    try {
      await updateWearPunchTimestamp(db, punch.id, timestamp);
      void reconcileLocalNotifications(db);
      router.back();
    } catch (saveError) {
      setError(knownCorrectionMessage(saveError));
      mutationInProgress.current = false;
      setPendingAction(null);
    }
  }

  async function deleteEvent() {
    if (mutationInProgress.current || deletionPlan === null) {
      return;
    }

    mutationInProgress.current = true;
    setPendingAction('delete');
    setError(null);

    try {
      await deleteWearPunch(db, deletionPlan);
      void reconcileLocalNotifications(db);
      router.back();
    } catch (deleteError) {
      setError(knownCorrectionMessage(deleteError));
      mutationInProgress.current = false;
      setPendingAction(null);
    }
  }

  function confirmDeletion() {
    if (deletionPlan === null) {
      return;
    }

    const confirmation = getWearPunchDeletionConfirmation(deletionPlan);
    Alert.alert(confirmation.title, confirmation.message, [
      { style: 'cancel', text: 'Cancel' },
      { onPress: () => void deleteEvent(), style: 'destructive', text: 'Delete' },
    ]);
  }

  if (isLoading) {
    return <AppLoadingScreen message="Loading event…" />;
  }

  if (punch === null) {
    return (
      <AppScreen scrollable>
        <View style={styles.message}>
          <AppText variant="heading">Event unavailable</AppText>
          <AppText muted>{error ?? 'This punch could not be found.'}</AppText>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={[styles.secondaryButton, { borderColor: theme.border }]}>
            <AppText>Back to punch history</AppText>
          </Pressable>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen keyboardAccessory={keyboardNavigation.accessory} scrollable>
      <AppText muted>Correct the recorded time. The IN/OUT status cannot be changed.</AppText>

      <View style={[styles.statusCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <AppText muted variant="caption">STATUS</AppText>
        <AppText style={{ color: theme.primary }} variant="heading">{punch.status}</AppText>
      </View>

      <DateTimeFields
        dateInputNavigation={keyboardNavigation.getInputProps(0)}
        dateValue={dateValue}
        disabled={pendingAction !== null}
        label="Recorded date and time"
        onChangeDate={(value) => {
          setDateValue(value);
          setError(null);
        }}
        onChangeTime={(value) => {
          setTimeValue(value);
          setError(null);
        }}
        timeInputNavigation={keyboardNavigation.getInputProps(1)}
        timeValue={timeValue}
      />

      {error ? (
        <AppText accessibilityLiveRegion="polite" style={{ color: theme.error }}>
          {error}
        </AppText>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={pendingAction !== null}
        onPress={() => void saveCorrection()}
        style={({ pressed }) => [
          styles.saveButton,
          {
            backgroundColor: pressed ? theme.primaryPressed : theme.primary,
            opacity: pendingAction !== null ? 0.6 : 1,
          },
        ]}>
        <AppText style={{ color: theme.onPrimary, fontWeight: '700' }}>
          {pendingAction === 'save' ? 'Saving…' : 'Save correction'}
        </AppText>
      </Pressable>

      {deletionPlan ? (
        <Pressable
          accessibilityRole="button"
          disabled={pendingAction !== null}
          onPress={confirmDeletion}
          style={({ pressed }) => [
            styles.deleteButton,
            {
              borderColor: theme.error,
              opacity: pendingAction !== null ? 0.6 : pressed ? 0.75 : 1,
            },
          ]}>
          <AppText style={{ color: theme.error, fontWeight: '700' }}>
            {pendingAction === 'delete' ? 'Deleting…' : 'Delete event'}
          </AppText>
        </Pressable>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  deleteButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: spacing.lg,
  },
  message: {
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
  },
  saveButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: spacing.lg,
  },
  secondaryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  statusCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
});
