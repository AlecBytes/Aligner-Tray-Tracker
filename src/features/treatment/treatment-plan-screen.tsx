import { type Href, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';

import { AppLoadingScreen } from '@/components/app-loading-screen';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { reconcileLocalNotifications } from '@/features/notifications/local-notifications';
import {
  type TreatmentPlanFormValues,
  type TreatmentPlanValidationErrors,
  validateTreatmentPlan,
} from '@/features/treatment/treatment-plan-validation';
import {
  createTreatmentPlanVersion,
  getActiveTrayNumber,
  getCurrentTreatmentPlan,
} from '@/features/treatment/treatment-repository';
import { radius, spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

type TreatmentPlanFieldProps = Pick<
  TextInputProps,
  'inputMode' | 'keyboardType' | 'returnKeyType'
> & {
  disabled: boolean;
  error?: string;
  label: string;
  onChangeText: (value: string) => void;
  onSubmitEditing?: () => void;
  value: string;
};

function TreatmentPlanField({ disabled, error, label, ...inputProps }: TreatmentPlanFieldProps) {
  const theme = useAppTheme();

  return (
    <View style={styles.field}>
      <AppText>{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        autoCorrect={false}
        editable={!disabled}
        selectTextOnFocus
        style={[
          styles.input,
          {
            backgroundColor: theme.surface,
            borderColor: error ? theme.error : theme.border,
            color: theme.text,
            opacity: disabled ? 0.65 : 1,
          },
        ]}
        {...inputProps}
      />
      {error ? (
        <AppText accessibilityLiveRegion="polite" style={{ color: theme.error }} variant="caption">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

export function TreatmentPlanScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useAppTheme();
  const submissionInProgress = useRef(false);
  const [values, setValues] = useState<TreatmentPlanFormValues | null>(null);
  const [currentTrayNumber, setCurrentTrayNumber] = useState<number | null>(null);
  const [errors, setErrors] = useState<TreatmentPlanValidationErrors>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadCurrentPlan = useCallback(async () => {
    const [currentPlan, activeTrayNumber] = await Promise.all([
      getCurrentTreatmentPlan(db),
      getActiveTrayNumber(db),
    ]);

    if (currentPlan === null || activeTrayNumber === null) {
      throw new Error('No active treatment plan exists.');
    }

    return {
      currentTrayNumber: activeTrayNumber,
      values: {
        daysPerTray: String(currentPlan.daysPerTray),
        prescribedHoursPerDay: String(currentPlan.dailyWearGoalMinutes / 60),
        totalTrays: String(currentPlan.totalTrays),
      },
    };
  }, [db]);

  const refreshCurrentPlan = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const currentPlan = await loadCurrentPlan();
      setCurrentTrayNumber(currentPlan.currentTrayNumber);
      setValues(currentPlan.values);
    } catch {
      setLoadError('The current treatment plan could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, [loadCurrentPlan]);

  useEffect(() => {
    let active = true;

    void loadCurrentPlan()
      .then((currentValues) => {
        if (active) {
          setCurrentTrayNumber(currentValues.currentTrayNumber);
          setValues(currentValues.values);
          setLoadError(null);
        }
      })
      .catch(() => {
        if (active) {
          setLoadError('The current treatment plan could not be loaded.');
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
  }, [loadCurrentPlan]);

  function updateValue(field: keyof TreatmentPlanFormValues, value: string) {
    setValues((currentValues) =>
      currentValues === null ? currentValues : { ...currentValues, [field]: value },
    );
    setErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }));
    setSaveError(null);
  }

  async function savePlan() {
    if (submissionInProgress.current || values === null) {
      return;
    }

    const validation = validateTreatmentPlan(values, currentTrayNumber ?? 1);

    if (!validation.success) {
      setErrors(validation.errors);
      return;
    }

    const timestamp = Date.now();
    submissionInProgress.current = true;
    setErrors({});
    setSaveError(null);
    setIsSaving(true);

    try {
      await createTreatmentPlanVersion(db, validation.data, timestamp);
      void reconcileLocalNotifications(db);
      router.dismissTo('/tracker');
    } catch {
      setSaveError('Treatment plan could not be saved. Please try again.');
      submissionInProgress.current = false;
      setIsSaving(false);
    }
  }

  if (values === null) {
    if (isLoading) {
      return <AppLoadingScreen message="Loading treatment plan…" />;
    }

    return (
      <AppScreen>
        <View style={styles.message}>
          <AppText variant="heading">Treatment plan unavailable</AppText>
          <AppText muted>{loadError ?? 'No treatment plan was found.'}</AppText>
          <Pressable
            accessibilityRole="button"
            onPress={() => void refreshCurrentPlan()}
            style={({ pressed }) => [
              styles.retryButton,
              {
                backgroundColor: pressed ? theme.border : theme.surface,
                borderColor: theme.border,
              },
            ]}>
            <AppText>Try again</AppText>
          </Pressable>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <View style={styles.heading}>
        <AppText muted>Update the plan prescribed for your current treatment.</AppText>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={isSaving}
        onPress={() => router.push('/treatment-plan-history' as Href)}
        style={({ pressed }) => [
          styles.historyButton,
          {
            backgroundColor: pressed ? theme.border : theme.surface,
            borderColor: theme.border,
            opacity: isSaving ? 0.6 : 1,
          },
        ]}>
        <AppText style={styles.historyButtonLabel}>View Plan History</AppText>
        <AppText muted>›</AppText>
      </Pressable>

      <View style={styles.form}>
        <TreatmentPlanField
          disabled={isSaving}
          error={errors.totalTrays}
          inputMode="numeric"
          keyboardType="number-pad"
          label="Total trays"
          onChangeText={(value) => updateValue('totalTrays', value)}
          value={values.totalTrays}
        />
        <TreatmentPlanField
          disabled={isSaving}
          error={errors.daysPerTray}
          inputMode="numeric"
          keyboardType="number-pad"
          label="Days per tray"
          onChangeText={(value) => updateValue('daysPerTray', value)}
          value={values.daysPerTray}
        />
        <TreatmentPlanField
          disabled={isSaving}
          error={errors.prescribedHoursPerDay}
          inputMode="decimal"
          keyboardType="decimal-pad"
          label="Prescribed hours per day"
          onChangeText={(value) => updateValue('prescribedHoursPerDay', value)}
          onSubmitEditing={() => void savePlan()}
          returnKeyType="done"
          value={values.prescribedHoursPerDay}
        />

        {saveError ? (
          <AppText accessibilityLiveRegion="polite" style={{ color: theme.error }}>
            {saveError}
          </AppText>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={isSaving}
          onPress={() => void savePlan()}
          style={({ pressed }) => [
            styles.saveButton,
            {
              backgroundColor: pressed ? theme.primaryPressed : theme.primary,
              opacity: isSaving ? 0.6 : 1,
            },
          ]}>
          <AppText style={{ color: theme.onPrimary, fontWeight: '700' }}>
            {isSaving ? 'Saving…' : 'Save changes'}
          </AppText>
        </Pressable>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.sm,
  },
  form: {
    gap: spacing.lg,
    paddingTop: spacing.md,
  },
  heading: {
    gap: spacing.sm,
  },
  historyButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  historyButtonLabel: {
    fontWeight: '700',
  },
  input: {
    borderRadius: radius.md,
    borderWidth: 1,
    fontSize: 18,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  message: {
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
  },
  retryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  saveButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    justifyContent: 'center',
    marginTop: spacing.sm,
    minHeight: 54,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
