import { DatePicker, Form, Host, Section, Text } from '@expo/ui/swift-ui';
import { disabled, font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';

import { AppLoadingScreen } from '@/components/app-loading-screen';
import {
  ActionButton,
  CenteredState,
  ValidationMessage,
} from '@/components/expo-ui-components';
import { CorrectionValidationError } from '@/features/edit-times/edit-times-corrections';
import type { EditableWearPunch } from '@/features/edit-times/edit-times-model';
import {
  CorrectionConflictError,
  getWearPunchForEdit,
  updateWearPunchTimestamp,
} from '@/features/edit-times/edit-times-repository';
import { reconcileLocalNotifications } from '@/features/notifications/local-notifications';
import { useAppTheme } from '@/theme/use-app-theme';

function firstParameter(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function knownCorrectionMessage(error: unknown) {
  return error instanceof CorrectionValidationError || error instanceof CorrectionConflictError
    ? error.message
    : 'The correction could not be saved. Your previous history is unchanged.';
}

function startOfMinute(timestamp: number) {
  const date = new Date(timestamp);
  date.setSeconds(0, 0);
  return date;
}

export function EditEventScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const idValue = firstParameter(params.id);
  const punchId = idValue && /^\d+$/.test(idValue) ? Number(idValue) : null;
  const saveInProgress = useRef(false);
  const [punch, setPunch] = useState<EditableWearPunch | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => startOfMinute(Date.now()));
  const [isLoading, setIsLoading] = useState(punchId !== null);
  const [isSaving, setIsSaving] = useState(false);
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
            setError('This punch no longer exists.');
            return;
          }
          setPunch(savedPunch.punch);
          setSelectedDate(startOfMinute(savedPunch.punch.timestamp));
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
    if (saveInProgress.current || punch === null) {
      return;
    }

    saveInProgress.current = true;
    setIsSaving(true);
    setError(null);

    try {
      await updateWearPunchTimestamp(db, punch.id, selectedDate.getTime());
      void reconcileLocalNotifications(db);
      router.back();
    } catch (saveError) {
      setError(knownCorrectionMessage(saveError));
      saveInProgress.current = false;
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <AppLoadingScreen message="Loading event…" />;
  }

  if (punch === null) {
    return (
      <Host seedColor={theme.primary} style={{ flex: 1 }}>
        <CenteredState
          actionLabel="Back to punch history"
          message={error ?? 'This punch could not be found.'}
          onAction={() => router.back()}
          title="Event unavailable"
        />
      </Host>
    );
  }

  return (
    <Host seedColor={theme.primary} style={{ flex: 1 }}>
      <Form>
        <Section
          footer={<Text>The IN/OUT status cannot be changed.</Text>}
          title="Recorded status">
          <Text modifiers={[font({ textStyle: 'title2', weight: 'bold' }), foregroundStyle(theme.primary)]}>
            {punch.status}
          </Text>
        </Section>

        <Section title="Recorded date and time">
          <DatePicker
            displayedComponents={['date']}
            modifiers={[disabled(isSaving)]}
            onDateChange={(date) => {
              setSelectedDate(startOfMinute(date.getTime()));
              setError(null);
            }}
            selection={selectedDate}
            title="Date"
          />
          <DatePicker
            displayedComponents={['hourAndMinute']}
            modifiers={[disabled(isSaving)]}
            onDateChange={(date) => {
              setSelectedDate(startOfMinute(date.getTime()));
              setError(null);
            }}
            selection={selectedDate}
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
            label={isSaving ? 'Saving…' : 'Save correction'}
            onPress={() => void saveCorrection()}
            pending={isSaving}
          />
        </Section>
      </Form>
    </Host>
  );
}
