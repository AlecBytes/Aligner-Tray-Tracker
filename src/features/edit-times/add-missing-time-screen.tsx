import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import type { WearStatus } from '@/db/schema';
import { DateTimeFields } from '@/features/edit-times/date-time-fields';
import { CorrectionValidationError } from '@/features/edit-times/edit-times-corrections';
import { parseLocalDateKey, parseLocalDateTime } from '@/features/edit-times/edit-times-dates';
import {
  addMissingWearPeriod,
  CorrectionConflictError,
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
    : 'The missing time could not be added. Your previous history is unchanged.';
}

export function AddMissingTimeScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ date?: string | string[] }>();
  const initialDate = firstParameter(params.date) ?? '';
  const validInitialDate = parseLocalDateKey(initialDate) === null ? '' : initialDate;
  const submissionInProgress = useRef(false);
  const [status, setStatus] = useState<WearStatus | null>(null);
  const [startDate, setStartDate] = useState(validInitialDate);
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState(validInitialDate);
  const [endTime, setEndTime] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveMissingTime() {
    if (submissionInProgress.current) {
      return;
    }

    if (status === null) {
      setError('Choose whether the trays were OUT or IN.');
      return;
    }

    const startTimestamp = parseLocalDateTime(startDate, startTime);
    const endTimestamp = parseLocalDateTime(endDate, endTime);

    if (startTimestamp === null || endTimestamp === null) {
      setError('Enter valid dates and times using YYYY-MM-DD and HH:MM:SS.');
      return;
    }

    submissionInProgress.current = true;
    setIsSaving(true);
    setError(null);

    try {
      await addMissingWearPeriod(db, { endTimestamp, startTimestamp, status });
      void reconcileLocalNotifications(db);
      router.back();
    } catch (saveError) {
      setError(knownCorrectionMessage(saveError));
      submissionInProgress.current = false;
      setIsSaving(false);
    }
  }

  return (
    <AppScreen>
      <AppText muted>
        Add one missing period. Both state transitions will be saved together.
      </AppText>

      <View style={styles.choiceGroup}>
        <AppText>During this period</AppText>
        <View style={styles.choices}>
          {(['OUT', 'IN'] as const).map((choice) => {
            const selected = status === choice;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                disabled={isSaving}
                key={choice}
                onPress={() => {
                  setStatus(choice);
                  setError(null);
                }}
                style={({ pressed }) => [
                  styles.choice,
                  {
                    backgroundColor: selected
                      ? theme.primary
                      : pressed
                        ? theme.border
                        : theme.surface,
                    borderColor: selected ? theme.primary : theme.border,
                    opacity: isSaving ? 0.65 : 1,
                  },
                ]}>
                <AppText style={{ color: selected ? theme.onPrimary : theme.text }}>
                  Trays were {choice}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <DateTimeFields
        dateValue={startDate}
        disabled={isSaving}
        label="Start"
        onChangeDate={(value) => {
          setStartDate(value);
          setError(null);
        }}
        onChangeTime={(value) => {
          setStartTime(value);
          setError(null);
        }}
        timeValue={startTime}
      />
      <DateTimeFields
        dateValue={endDate}
        disabled={isSaving}
        label="End"
        onChangeDate={(value) => {
          setEndDate(value);
          setError(null);
        }}
        onChangeTime={(value) => {
          setEndTime(value);
          setError(null);
        }}
        timeValue={endTime}
      />

      {error ? (
        <AppText accessibilityLiveRegion="polite" style={{ color: theme.error }}>
          {error}
        </AppText>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={isSaving}
        onPress={() => void saveMissingTime()}
        style={({ pressed }) => [
          styles.saveButton,
          {
            backgroundColor: pressed ? theme.primaryPressed : theme.primary,
            opacity: isSaving ? 0.6 : 1,
          },
        ]}>
        <AppText style={{ color: theme.onPrimary, fontWeight: '700' }}>
          {isSaving ? 'Adding…' : 'Add missing time'}
        </AppText>
      </Pressable>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  choice: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: spacing.sm,
  },
  choiceGroup: {
    gap: spacing.sm,
  },
  choices: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  saveButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: spacing.lg,
  },
});

