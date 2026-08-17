import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { initializeLocalNotifications } from '@/features/notifications/local-notifications';
import { createInitialTreatment } from '@/features/treatment/treatment-repository';
import {
  type TreatmentSetupFormValues,
  type TreatmentSetupValidationErrors,
  validateTreatmentSetup,
} from '@/features/treatment/treatment-setup-validation';
import { radius, spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

const INITIAL_VALUES: TreatmentSetupFormValues = {
  daysPerTray: '',
  prescribedHoursPerDay: '',
  startingTrayNumber: '',
  totalTrays: '',
};

type SetupFieldProps = Pick<TextInputProps, 'inputMode' | 'keyboardType' | 'returnKeyType'> & {
  error?: string;
  label: string;
  onChangeText: (value: string) => void;
  onSubmitEditing?: () => void;
  value: string;
};

function SetupField({ error, label, ...inputProps }: SetupFieldProps) {
  const theme = useAppTheme();

  return (
    <View style={styles.field}>
      <AppText>{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        autoCorrect={false}
        selectTextOnFocus
        style={[
          styles.input,
          {
            backgroundColor: theme.surface,
            borderColor: error ? theme.error : theme.border,
            color: theme.text,
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

export function SetupScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useAppTheme();
  const submissionInProgress = useRef(false);
  const [values, setValues] = useState(INITIAL_VALUES);
  const [errors, setErrors] = useState<TreatmentSetupValidationErrors>({});
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateValue(field: keyof TreatmentSetupFormValues, value: string) {
    setValues((currentValues) => ({ ...currentValues, [field]: value }));
    setErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }));
    setSubmissionError(null);
  }

  async function submitSetup() {
    if (submissionInProgress.current) {
      return;
    }

    const validation = validateTreatmentSetup(values);

    if (!validation.success) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setSubmissionError(null);
    submissionInProgress.current = true;
    setIsSubmitting(true);

    try {
      await createInitialTreatment(db, validation.data);
      void initializeLocalNotifications(db);
      router.replace('/tracker');
    } catch {
      setSubmissionError('Treatment setup could not be saved. Please try again.');
      submissionInProgress.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <AppScreen>
      <View style={styles.heading}>
        <AppText variant="title">Treatment setup</AppText>
        <AppText muted>Enter the plan prescribed for your current treatment.</AppText>
      </View>

      <View style={styles.form}>
        <SetupField
          error={errors.totalTrays}
          inputMode="numeric"
          keyboardType="number-pad"
          label="Total number of trays"
          onChangeText={(value) => updateValue('totalTrays', value)}
          value={values.totalTrays}
        />
        <SetupField
          error={errors.startingTrayNumber}
          inputMode="numeric"
          keyboardType="number-pad"
          label="Starting tray number"
          onChangeText={(value) => updateValue('startingTrayNumber', value)}
          value={values.startingTrayNumber}
        />
        <SetupField
          error={errors.daysPerTray}
          inputMode="numeric"
          keyboardType="number-pad"
          label="Days per tray"
          onChangeText={(value) => updateValue('daysPerTray', value)}
          value={values.daysPerTray}
        />
        <SetupField
          error={errors.prescribedHoursPerDay}
          inputMode="decimal"
          keyboardType="decimal-pad"
          label="Prescribed hours per day"
          onChangeText={(value) => updateValue('prescribedHoursPerDay', value)}
          onSubmitEditing={() => void submitSetup()}
          returnKeyType="done"
          value={values.prescribedHoursPerDay}
        />

        {submissionError ? (
          <AppText accessibilityLiveRegion="polite" style={{ color: theme.error }}>
            {submissionError}
          </AppText>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={isSubmitting}
          onPress={() => void submitSetup()}
          style={({ pressed }) => [
            styles.submitButton,
            {
              backgroundColor: pressed ? theme.primaryPressed : theme.primary,
              opacity: isSubmitting ? 0.6 : 1,
            },
          ]}>
          <AppText style={{ color: theme.onPrimary, fontWeight: '700' }}>
            {isSubmitting ? 'Saving…' : 'Start tracking'}
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
    paddingTop: spacing.xl,
  },
  input: {
    borderRadius: radius.md,
    borderWidth: 1,
    fontSize: 18,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  submitButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    justifyContent: 'center',
    marginTop: spacing.sm,
    minHeight: 54,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
