import { DatePicker, Form, Host, Picker, Section, Text } from '@expo/ui/swift-ui';
import { disabled, environment, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useRef, useState } from 'react';

import { ActionButton, ValidationMessage } from '@/components/expo-ui-components';
import type { WearStatus } from '@/db/schema';
import { CorrectionValidationError } from '@/features/edit-times/edit-times-corrections';
import { parseLocalDateKey } from '@/features/edit-times/edit-times-dates';
import {
  addMissingWearPeriod,
  CorrectionConflictError,
} from '@/features/edit-times/edit-times-repository';
import { reconcileLocalNotifications } from '@/features/notifications/local-notifications';
import { useAppTheme } from '@/theme/use-app-theme';

function firstParameter(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function knownCorrectionMessage(error: unknown) {
  return error instanceof CorrectionValidationError || error instanceof CorrectionConflictError
    ? error.message
    : 'The missing time could not be added. Your previous history is unchanged.';
}

function initialDateForRoute(dateKey: string | undefined) {
  const dayStart = dateKey ? parseLocalDateKey(dateKey) : null;
  const now = new Date();
  const date = dayStart === null ? now : new Date(dayStart);
  if (dayStart !== null) {
    date.setHours(now.getHours(), now.getMinutes(), 0, 0);
  } else {
    date.setSeconds(0, 0);
  }
  return date;
}

function startOfMinute(date: Date) {
  const normalized = new Date(date);
  normalized.setSeconds(0, 0);
  return normalized;
}

export function AddMissingTimeScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ date?: string | string[] }>();
  const initialDateKey = firstParameter(params.date);
  const submissionInProgress = useRef(false);
  const [status, setStatus] = useState<WearStatus | null>(null);
  const [startDate, setStartDate] = useState(() => initialDateForRoute(initialDateKey));
  const [endDate, setEndDate] = useState(() => initialDateForRoute(initialDateKey));
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

    submissionInProgress.current = true;
    setIsSaving(true);
    setError(null);

    try {
      await addMissingWearPeriod(db, {
        endTimestamp: endDate.getTime(),
        startTimestamp: startDate.getTime(),
        status,
      });
      void reconcileLocalNotifications(db);
      router.back();
    } catch (saveError) {
      setError(knownCorrectionMessage(saveError));
      submissionInProgress.current = false;
      setIsSaving(false);
    }
  }

  return (
    <Host seedColor={theme.primary} style={{ flex: 1 }}>
      <Form>
        <Section footer={<Text>Both state transitions will be saved together.</Text>}>
          <Text>Add one missing period.</Text>
        </Section>

        <Section title="During this period">
          <Picker<WearStatus | null>
            label="Trays were"
            modifiers={[pickerStyle('segmented'), disabled(isSaving)]}
            onSelectionChange={(selection) => {
              setStatus(selection);
              setError(null);
            }}
            selection={status}>
            <Text modifiers={[tag('OUT')]}>OUT</Text>
            <Text modifiers={[tag('IN')]}>IN</Text>
          </Picker>
        </Section>

        <Section title="Start">
          <DatePicker
            displayedComponents={['date']}
            modifiers={[disabled(isSaving)]}
            onDateChange={(date) => {
              setStartDate(startOfMinute(date));
              setError(null);
            }}
            selection={startDate}
            title="Date"
          />
          <DatePicker
            displayedComponents={['hourAndMinute']}
            modifiers={[environment('locale', 'en_US'), disabled(isSaving)]}
            onDateChange={(date) => {
              setStartDate(startOfMinute(date));
              setError(null);
            }}
            selection={startDate}
            title="Time"
          />
        </Section>

        <Section title="End">
          <DatePicker
            displayedComponents={['date']}
            modifiers={[disabled(isSaving)]}
            onDateChange={(date) => {
              setEndDate(startOfMinute(date));
              setError(null);
            }}
            selection={endDate}
            title="Date"
          />
          <DatePicker
            displayedComponents={['hourAndMinute']}
            modifiers={[environment('locale', 'en_US'), disabled(isSaving)]}
            onDateChange={(date) => {
              setEndDate(startOfMinute(date));
              setError(null);
            }}
            selection={endDate}
            title="Time"
          />
        </Section>

        {error ? (
          <Section>
            <ValidationMessage message={error} />
          </Section>
        ) : null}

        <Section>
          <ActionButton
            label={isSaving ? 'Adding…' : 'Add missing time'}
            onPress={() => void saveMissingTime()}
            pending={isSaving}
          />
        </Section>
      </Form>
    </Host>
  );
}
