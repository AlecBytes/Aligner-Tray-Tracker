import {
  Form,
  Host,
  Section,
  Text,
  TextField,
  type TextFieldRef,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  autocorrectionDisabled,
  disabled,
  keyboardType,
  onSubmit,
  scrollDismissesKeyboard,
  submitLabel,
  textInputAutocapitalization,
} from '@expo/ui/swift-ui/modifiers';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  ActionButton,
  CenteredState,
  NavigationRow,
  ValidationMessage,
} from '@/components/expo-ui-components';
import { reconcileLocalNotifications } from '@/features/notifications/local-notifications';
import { refreshWatchTrackerSnapshot } from '@/features/siri/aligner-tracker-intents';
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
import { useAppTheme } from '@/theme/use-app-theme';

type PlanField = keyof TreatmentPlanFormValues;

const FIELD_ORDER: readonly PlanField[] = [
  'totalTrays',
  'daysPerTray',
  'prescribedHoursPerDay',
];

export function TreatmentPlanScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useAppTheme();
  const totalTrays = useNativeState('');
  const daysPerTray = useNativeState('');
  const prescribedHoursPerDay = useNativeState('');
  const totalTraysRef = useRef<TextFieldRef>(null);
  const daysPerTrayRef = useRef<TextFieldRef>(null);
  const prescribedHoursPerDayRef = useRef<TextFieldRef>(null);
  const submissionInProgress = useRef(false);
  const [hasPlan, setHasPlan] = useState(false);
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

  const applyCurrentPlan = useCallback(
    (currentPlan: Awaited<ReturnType<typeof loadCurrentPlan>>) => {
      totalTrays.set(currentPlan.values.totalTrays);
      daysPerTray.set(currentPlan.values.daysPerTray);
      prescribedHoursPerDay.set(currentPlan.values.prescribedHoursPerDay);
      setCurrentTrayNumber(currentPlan.currentTrayNumber);
      setHasPlan(true);
    },
    [daysPerTray, prescribedHoursPerDay, totalTrays],
  );

  const refreshCurrentPlan = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      applyCurrentPlan(await loadCurrentPlan());
    } catch {
      setLoadError('The current treatment plan could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, [applyCurrentPlan, loadCurrentPlan]);

  useEffect(() => {
    let active = true;

    void loadCurrentPlan()
      .then((currentPlan) => {
        if (active) {
          applyCurrentPlan(currentPlan);
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
  }, [applyCurrentPlan, loadCurrentPlan]);

  function clearFieldError(field: PlanField) {
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSaveError(null);
  }

  function focusField(field: PlanField) {
    const ref = {
      daysPerTray: daysPerTrayRef,
      prescribedHoursPerDay: prescribedHoursPerDayRef,
      totalTrays: totalTraysRef,
    }[field];
    void ref.current?.focus();
  }

  async function savePlan() {
    if (submissionInProgress.current || !hasPlan) {
      return;
    }

    const validation = validateTreatmentPlan(
      {
        daysPerTray: daysPerTray.get(),
        prescribedHoursPerDay: prescribedHoursPerDay.get(),
        totalTrays: totalTrays.get(),
      },
      currentTrayNumber ?? 1,
    );

    if (!validation.success) {
      setErrors(validation.errors);
      const firstInvalidField = FIELD_ORDER.find((field) => validation.errors[field]);
      if (firstInvalidField) {
        requestAnimationFrame(() => focusField(firstInvalidField));
      }
      return;
    }

    submissionInProgress.current = true;
    setErrors({});
    setSaveError(null);
    setIsSaving(true);

    try {
      // This runs only from native button/submit events, never during render.
      // eslint-disable-next-line react-hooks/purity
      await createTreatmentPlanVersion(db, validation.data, Date.now());
      void reconcileLocalNotifications(db);
      void refreshWatchTrackerSnapshot();
      router.dismissTo('/tracker');
    } catch {
      setSaveError('Treatment plan could not be saved. Please try again.');
      submissionInProgress.current = false;
      setIsSaving(false);
    }
  }

  if (!hasPlan) {
    return (
      <Host seedColor={theme.primary} style={{ flex: 1 }}>
        {isLoading ? (
          <CenteredState message="Loading the current settings." title="Loading treatment plan…" />
        ) : (
          <CenteredState
            actionLabel="Try again"
            message={loadError ?? 'No treatment plan was found.'}
            onAction={() => void refreshCurrentPlan()}
            title="Treatment plan unavailable"
          />
        )}
      </Host>
    );
  }

  const fieldModifiers = (
    field: PlanField,
    label: string,
    keyboard: 'numeric' | 'decimal-pad',
    nextField?: PlanField,
  ) => [
    accessibilityLabel(label),
    autocorrectionDisabled(),
    keyboardType(keyboard),
    textInputAutocapitalization('never'),
    submitLabel(nextField ? 'next' : 'done'),
    onSubmit(() => {
      if (nextField) {
        focusField(nextField);
      } else {
        void prescribedHoursPerDayRef.current?.blur();
        void savePlan();
      }
    }),
    disabled(isSaving),
  ];

  return (
    <Host seedColor={theme.primary} style={{ flex: 1 }}>
      <Form modifiers={[scrollDismissesKeyboard('interactively')]}>
        <Section footer={<Text>Update the plan prescribed for your current treatment.</Text>}>
          <NavigationRow
            disabled={isSaving}
            label="View Plan History"
            onPress={() => router.push('/treatment-plan-history')}
            systemImage="clock.arrow.circlepath"
          />
        </Section>

        <Section footer={<ValidationMessage message={errors.totalTrays} />} title="Total trays">
          <TextField
            onTextChange={() => clearFieldError('totalTrays')}
            placeholder="Enter total trays"
            ref={totalTraysRef}
            text={totalTrays}
            // Expo UI invokes modifier callbacks only after a native submit event.
            // eslint-disable-next-line react-hooks/refs
            modifiers={fieldModifiers('totalTrays', 'Total trays', 'numeric', 'daysPerTray')}
          />
        </Section>

        <Section footer={<ValidationMessage message={errors.daysPerTray} />} title="Days per tray">
          <TextField
            onTextChange={() => clearFieldError('daysPerTray')}
            placeholder="Enter days per tray"
            ref={daysPerTrayRef}
            text={daysPerTray}
            // Expo UI invokes modifier callbacks only after a native submit event.
            // eslint-disable-next-line react-hooks/refs
            modifiers={fieldModifiers(
              'daysPerTray',
              'Days per tray',
              'numeric',
              'prescribedHoursPerDay',
            )}
          />
        </Section>

        <Section
          footer={<ValidationMessage message={errors.prescribedHoursPerDay} />}
          title="Prescribed hours per day">
          <TextField
            onTextChange={() => clearFieldError('prescribedHoursPerDay')}
            placeholder="Enter hours per day"
            ref={prescribedHoursPerDayRef}
            text={prescribedHoursPerDay}
            // Expo UI invokes modifier callbacks only after a native submit event.
            // eslint-disable-next-line react-hooks/refs
            modifiers={fieldModifiers(
              'prescribedHoursPerDay',
              'Prescribed hours per day',
              'decimal-pad',
            )}
          />
        </Section>

        {saveError ? (
          <Section>
            <ValidationMessage message={saveError} />
          </Section>
        ) : null}

        <Section>
          <ActionButton
            disabled={isSaving}
            label={isSaving ? 'Saving…' : 'Save changes'}
            onPress={() => void savePlan()}
            pending={isSaving}
          />
        </Section>
      </Form>
    </Host>
  );
}
