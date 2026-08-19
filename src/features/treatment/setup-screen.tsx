import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { useFormKeyboardNavigation } from '@/components/form-keyboard-navigation';
import { initializeLocalNotifications } from '@/features/notifications/local-notifications';
import { TreatmentFormField } from '@/features/treatment/treatment-form-field';
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

export function SetupScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useAppTheme();
  const keyboardNavigation = useFormKeyboardNavigation(4, 'treatment-setup-keyboard');
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
      keyboardNavigation.focusFirstInvalid([
        validation.errors.totalTrays,
        validation.errors.startingTrayNumber,
        validation.errors.daysPerTray,
        validation.errors.prescribedHoursPerDay,
      ]);
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
    <AppScreen keyboardAccessory={keyboardNavigation.accessory} scrollable>
      <View style={styles.heading}>
        <AppText variant="title">Treatment setup</AppText>
        <AppText muted>Enter the plan prescribed for your current treatment.</AppText>
      </View>

      <View style={styles.form}>
        <TreatmentFormField
          error={errors.totalTrays}
          inputMode="numeric"
          keyboardType="number-pad"
          label="Total number of trays"
          navigation={keyboardNavigation.getInputProps(0)}
          onChangeText={(value) => updateValue('totalTrays', value)}
          value={values.totalTrays}
        />
        <TreatmentFormField
          error={errors.startingTrayNumber}
          inputMode="numeric"
          keyboardType="number-pad"
          label="Starting tray number"
          navigation={keyboardNavigation.getInputProps(1)}
          onChangeText={(value) => updateValue('startingTrayNumber', value)}
          value={values.startingTrayNumber}
        />
        <TreatmentFormField
          error={errors.daysPerTray}
          inputMode="numeric"
          keyboardType="number-pad"
          label="Days per tray"
          navigation={keyboardNavigation.getInputProps(2)}
          onChangeText={(value) => updateValue('daysPerTray', value)}
          value={values.daysPerTray}
        />
        <TreatmentFormField
          error={errors.prescribedHoursPerDay}
          inputMode="decimal"
          keyboardType="decimal-pad"
          label="Prescribed hours per day"
          navigation={keyboardNavigation.getInputProps(3)}
          onChangeText={(value) => updateValue('prescribedHoursPerDay', value)}
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
  form: {
    gap: spacing.lg,
    paddingTop: spacing.md,
  },
  heading: {
    gap: spacing.sm,
    paddingTop: spacing.xl,
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
