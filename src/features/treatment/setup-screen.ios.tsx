import {
  Button,
  Form,
  Host,
  HStack,
  Picker,
  ProgressView,
  Section,
  Spacer,
  Text,
  TextField,
  type TextFieldRef,
  useNativeState,
  VStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  autocorrectionDisabled,
  buttonStyle,
  controlSize,
  disabled,
  font,
  foregroundStyle,
  keyboardType,
  onSubmit,
  pickerStyle,
  scrollDismissesKeyboard,
  submitLabel,
  tag,
  textInputAutocapitalization,
} from '@expo/ui/swift-ui/modifiers';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo, useRef, useState } from 'react';

import { isLiquidGlassPlatform } from '@/components/expo-ui-components';
import { initializeLocalNotifications } from '@/features/notifications/local-notifications';
import { createInitialTreatment } from '@/features/treatment/treatment-repository';
import {
  type TreatmentSetupFormValues,
  type TreatmentSetupValidationErrors,
  validateTreatmentSetup,
} from '@/features/treatment/treatment-setup-validation';
import { parsePositiveInteger } from '@/features/treatment/treatment-plan-validation';
import { useAppTheme } from '@/theme/use-app-theme';

type SetupField = keyof TreatmentSetupFormValues;

const FIELD_ORDER: readonly SetupField[] = [
  'totalTrays',
  'startingTrayNumber',
  'daysPerTray',
  'prescribedHoursPerDay',
];
const MAX_ENUMERATED_STARTING_TRAYS = 200;

export function SetupScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useAppTheme();
  const totalTrays = useNativeState('');
  const startingTrayText = useNativeState('');
  const daysPerTray = useNativeState('');
  const prescribedHoursPerDay = useNativeState('');
  const totalTraysRef = useRef<TextFieldRef>(null);
  const startingTrayTextRef = useRef<TextFieldRef>(null);
  const daysPerTrayRef = useRef<TextFieldRef>(null);
  const prescribedHoursPerDayRef = useRef<TextFieldRef>(null);
  const submissionInProgress = useRef(false);
  const [startingTrayNumber, setStartingTrayNumber] = useState('');
  const [totalTrayCount, setTotalTrayCount] = useState<number | null>(null);
  const [errors, setErrors] = useState<TreatmentSetupValidationErrors>({});
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function clearFieldError(field: SetupField) {
    setErrors((currentErrors) =>
      currentErrors[field] ? { ...currentErrors, [field]: undefined } : currentErrors,
    );
    setSubmissionError(null);
  }

  function updateTotalTrays(value: string) {
    clearFieldError('totalTrays');

    const parsedTotalTrays = parsePositiveInteger(value);
    setTotalTrayCount(parsedTotalTrays);

    const parsedCurrentTray = parsePositiveInteger(startingTrayNumber);
    const nextStartingTray =
      parsedTotalTrays === null || parsedCurrentTray === null
        ? ''
        : String(Math.min(parsedCurrentTray, parsedTotalTrays));
    setStartingTrayNumber(nextStartingTray);
    startingTrayText.set(nextStartingTray);
  }

  function focusField(field: SetupField) {
    const ref = {
      daysPerTray: daysPerTrayRef,
      prescribedHoursPerDay: prescribedHoursPerDayRef,
      startingTrayNumber: startingTrayTextRef,
      totalTrays: totalTraysRef,
    }[field];

    void ref?.current?.focus();
  }

  function currentValues(): TreatmentSetupFormValues {
    const currentTotalTrayCount = parsePositiveInteger(totalTrays.get());

    return {
      daysPerTray: daysPerTray.get(),
      prescribedHoursPerDay: prescribedHoursPerDay.get(),
      startingTrayNumber:
        currentTotalTrayCount !== null &&
        currentTotalTrayCount <= MAX_ENUMERATED_STARTING_TRAYS
          ? startingTrayNumber
          : startingTrayText.get(),
      totalTrays: totalTrays.get(),
    };
  }

  async function submitSetup() {
    if (submissionInProgress.current) {
      return;
    }

    const validation = validateTreatmentSetup(currentValues());

    if (!validation.success) {
      setErrors(validation.errors);
      const firstInvalidField = FIELD_ORDER.find((field) => validation.errors[field]);

      if (firstInvalidField) {
        requestAnimationFrame(() => focusField(firstInvalidField));
      }
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

  const integerFieldModifiers = (nextField: SetupField, label: string) => [
    accessibilityLabel(label),
    autocorrectionDisabled(),
    keyboardType('numeric'),
    textInputAutocapitalization('never'),
    submitLabel('next'),
    onSubmit(() => focusField(nextField)),
  ];
  const startingTrayOptions = useMemo(
    () =>
      totalTrayCount !== null && totalTrayCount <= MAX_ENUMERATED_STARTING_TRAYS
        ? Array.from({ length: totalTrayCount }, (_, index) => String(index + 1))
        : [],
    [totalTrayCount],
  );
  const usesStartingTrayPicker =
    totalTrayCount === null || totalTrayCount <= MAX_ENUMERATED_STARTING_TRAYS;
  const errorFooter = (message?: string) =>
    message ? (
      <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(theme.error)]}>
        {message}
      </Text>
    ) : undefined;

  return (
    <Host seedColor={theme.primary} style={{ flex: 1 }}>
      <Form modifiers={[scrollDismissesKeyboard('interactively')]}>
        <Section>
          <VStack alignment="leading" spacing={8}>
            <Text modifiers={[font({ textStyle: 'largeTitle', weight: 'bold' })]}>
              Treatment setup
            </Text>
            <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
              Enter the plan prescribed for your current treatment.
            </Text>
          </VStack>
        </Section>

        <Section footer={errorFooter(errors.totalTrays)} title="Total number of trays">
          <TextField
            onTextChange={updateTotalTrays}
            placeholder="Enter total trays"
            ref={totalTraysRef}
            text={totalTrays}
            modifiers={[
              accessibilityLabel('Total number of trays'),
              autocorrectionDisabled(),
              keyboardType('numeric'),
              textInputAutocapitalization('never'),
              submitLabel('next'),
              // Expo UI stores the modifier callback and invokes it only after a native submit.
              // eslint-disable-next-line react-hooks/refs
              onSubmit(() =>
                focusField(usesStartingTrayPicker ? 'daysPerTray' : 'startingTrayNumber'),
              ),
            ]}
          />
        </Section>

        <Section footer={errorFooter(errors.startingTrayNumber)} title="Starting tray number">
          {usesStartingTrayPicker ? (
            <Picker<string>
              label="Starting tray"
              modifiers={[
                accessibilityLabel('Starting tray number'),
                pickerStyle('menu'),
                disabled(totalTrayCount === null),
              ]}
              onSelectionChange={(selection) => {
                setStartingTrayNumber(selection);
                startingTrayText.set(selection);
                clearFieldError('startingTrayNumber');
              }}
              selection={startingTrayNumber}>
              <Text modifiers={[tag('')]}>Select a tray</Text>
              {startingTrayOptions.map((trayNumber) => (
                <Text key={trayNumber} modifiers={[tag(trayNumber)]}>
                  {trayNumber}
                </Text>
              ))}
            </Picker>
          ) : (
            <TextField
              onTextChange={(value) => {
                setStartingTrayNumber(value);
                clearFieldError('startingTrayNumber');
              }}
              placeholder={`1–${totalTrayCount}`}
              ref={startingTrayTextRef}
              text={startingTrayText}
              // Expo UI stores the modifier callback and invokes it only after a native submit.
              // eslint-disable-next-line react-hooks/refs
              modifiers={integerFieldModifiers('daysPerTray', 'Starting tray number')}
            />
          )}
        </Section>

        <Section footer={errorFooter(errors.daysPerTray)} title="Days per tray">
          <TextField
            onTextChange={() => clearFieldError('daysPerTray')}
            placeholder="Enter days per tray"
            ref={daysPerTrayRef}
            text={daysPerTray}
            // Expo UI stores the modifier callback and invokes it only after a native submit.
            // eslint-disable-next-line react-hooks/refs
            modifiers={integerFieldModifiers('prescribedHoursPerDay', 'Days per tray')}
          />
        </Section>

        <Section
          footer={errorFooter(errors.prescribedHoursPerDay)}
          title="Prescribed hours per day">
          <TextField
            onTextChange={() => clearFieldError('prescribedHoursPerDay')}
            placeholder="Enter hours per day"
            ref={prescribedHoursPerDayRef}
            text={prescribedHoursPerDay}
            modifiers={[
              accessibilityLabel('Prescribed hours per day'),
              autocorrectionDisabled(),
              keyboardType('decimal-pad'),
              textInputAutocapitalization('never'),
              submitLabel('done'),
              // Expo UI stores the modifier callback and invokes it only after a native submit.
              // eslint-disable-next-line react-hooks/refs
              onSubmit(() => {
                void prescribedHoursPerDayRef.current?.blur();
                void submitSetup();
              }),
            ]}
          />
        </Section>

        {submissionError ? (
          <Section>
            <Text modifiers={[foregroundStyle(theme.error)]}>{submissionError}</Text>
          </Section>
        ) : null}

        <Section>
          <Button
            modifiers={[
              buttonStyle(isLiquidGlassPlatform() ? 'glassProminent' : 'borderedProminent'),
              controlSize('large'),
              disabled(isSubmitting),
            ]}
            onPress={() => void submitSetup()}>
            <HStack spacing={8}>
              <Spacer />
              {isSubmitting ? <ProgressView /> : null}
              <Text>{isSubmitting ? 'Saving…' : 'Start tracking'}</Text>
              <Spacer />
            </HStack>
          </Button>
        </Section>
      </Form>
    </Host>
  );
}
