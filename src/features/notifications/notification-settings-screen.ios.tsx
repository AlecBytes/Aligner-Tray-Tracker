import {
  DatePicker,
  Form,
  Host,
  HStack,
  Section,
  Spacer,
  Text,
  TextField,
  Toggle,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  autocorrectionDisabled,
  disabled,
  foregroundStyle,
  keyboardType,
  scrollDismissesKeyboard,
  submitLabel,
  textInputAutocapitalization,
} from '@expo/ui/swift-ui/modifiers';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import { Linking } from 'react-native';

import { AppLoadingScreen } from '@/components/app-loading-screen';
import {
  ActionButton,
  CenteredState,
  ValidationMessage,
} from '@/components/expo-ui-components';
import type { Settings } from '@/db/schema';
import {
  getLocalNotificationPermissionState,
  type LocalNotificationPermissionState,
  reconcileLocalNotifications,
} from '@/features/notifications/local-notifications';
import {
  formatReminderTime,
  type NotificationSettingsValidationErrors,
  validateNotificationSettings,
} from '@/features/notifications/notification-settings-model';
import {
  getNotificationSettings,
  updateNotificationSettings,
} from '@/features/notifications/notification-settings-repository';
import { useAppTheme } from '@/theme/use-app-theme';

function permissionMessage(permission: LocalNotificationPermissionState) {
  switch (permission) {
    case 'granted':
      return 'Notifications are allowed by your device.';
    case 'denied':
      return 'Notifications are blocked by your device. Your reminder preferences are still saved.';
    case 'undetermined':
      return 'Your device will ask for permission when you save an enabled reminder.';
    case 'unavailable':
      return 'Notification status is unavailable. Your reminder preferences are still saved.';
  }
}

function reminderDate(hour: number, minute: number) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date;
}

export function NotificationSettingsScreen() {
  const db = useSQLiteContext();
  const theme = useAppTheme();
  const outReminderMinutes = useNativeState('');
  const saveInProgress = useRef(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [trayChangeReminderTime, setTrayChangeReminderTime] = useState(() => reminderDate(9, 0));
  const [errors, setErrors] = useState<NotificationSettingsValidationErrors>({});
  const [permission, setPermission] = useState<LocalNotificationPermissionState>('unavailable');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    const [persistedSettings, permissionState] = await Promise.all([
      getNotificationSettings(db),
      getLocalNotificationPermissionState(),
    ]);
    return { permissionState, persistedSettings };
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setIsLoading(true);

      void loadSettings()
        .then(({ permissionState, persistedSettings }) => {
          if (!active) {
            return;
          }
          outReminderMinutes.set(String(persistedSettings.outReminderMinutes));
          setTrayChangeReminderTime(
            reminderDate(
              persistedSettings.trayChangeReminderHour,
              persistedSettings.trayChangeReminderMinute,
            ),
          );
          setSettings(persistedSettings);
          setPermission(permissionState);
          setLoadError(null);
        })
        .catch(() => {
          if (active) {
            setLoadError('Notification settings could not be loaded.');
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
    }, [loadSettings, outReminderMinutes]),
  );

  function clearFeedback() {
    setSaveError(null);
    setSaveMessage(null);
  }

  function updateSwitch(field: 'outReminderEnabled' | 'trayChangeReminderEnabled', value: boolean) {
    setSettings((current) => (current === null ? current : { ...current, [field]: value }));
    clearFeedback();
  }

  async function saveSettings() {
    if (saveInProgress.current || settings === null) {
      return;
    }

    const validation = validateNotificationSettings({
      outReminderMinutes: outReminderMinutes.get(),
      trayChangeReminderTime: formatReminderTime(
        trayChangeReminderTime.getHours(),
        trayChangeReminderTime.getMinutes(),
      ),
    });

    if (!validation.success) {
      setErrors(validation.errors);
      return;
    }

    const nextSettings: Settings = { ...settings, ...validation.data };
    saveInProgress.current = true;
    setIsSaving(true);
    setErrors({});
    clearFeedback();

    try {
      await updateNotificationSettings(db, nextSettings);
      setSettings(nextSettings);
      outReminderMinutes.set(String(nextSettings.outReminderMinutes));
      setTrayChangeReminderTime(
        reminderDate(
          nextSettings.trayChangeReminderHour,
          nextSettings.trayChangeReminderMinute,
        ),
      );
      setSaveMessage('Notification settings saved.');

      await reconcileLocalNotifications(db, {
        requestPermission:
          nextSettings.outReminderEnabled || nextSettings.trayChangeReminderEnabled,
      });
      setPermission(await getLocalNotificationPermissionState());
    } catch {
      setSaveError('Notification settings could not be saved. Please try again.');
    } finally {
      saveInProgress.current = false;
      setIsSaving(false);
    }
  }

  async function openDeviceSettings() {
    setSaveError(null);
    try {
      await Linking.openSettings();
    } catch {
      setSaveError('Device notification settings could not be opened.');
    }
  }

  if (settings === null) {
    if (isLoading) {
      return <AppLoadingScreen message="Loading notification settings…" />;
    }

    return (
      <Host seedColor={theme.primary} style={{ flex: 1 }}>
        <CenteredState
          message={loadError ?? 'Notification settings could not be loaded.'}
          title="Notifications unavailable"
        />
      </Host>
    );
  }

  const canOpenDeviceSettings = permission !== 'granted';

  return (
    <Host seedColor={theme.primary} style={{ flex: 1 }}>
      <Form modifiers={[scrollDismissesKeyboard('interactively')]}>
        <Section
          footer={
            <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
              {permissionMessage(permission)}
            </Text>
          }
          title="Device permission">
          {canOpenDeviceSettings ? (
            <ActionButton
              label="Open device settings"
              onPress={() => void openDeviceSettings()}
              prominent={false}
            />
          ) : (
            <Text>Notifications allowed</Text>
          )}
        </Section>

        <Section
          footer={<ValidationMessage message={errors.outReminderMinutes} />}
          title="OUT Reminder">
          <Toggle
            isOn={settings.outReminderEnabled}
            label="Remind me when trays have been out too long"
            modifiers={[disabled(isSaving)]}
            onIsOnChange={(value) => updateSwitch('outReminderEnabled', value)}
          />
          <HStack spacing={12}>
            <Text>Remind me after</Text>
            <Spacer />
            <TextField
              onTextChange={() => {
                setErrors((current) => ({ ...current, outReminderMinutes: undefined }));
                clearFeedback();
              }}
              placeholder="45"
              text={outReminderMinutes}
              modifiers={[
                accessibilityLabel('OUT reminder minutes'),
                autocorrectionDisabled(),
                keyboardType('numeric'),
                textInputAutocapitalization('never'),
                submitLabel('done'),
                disabled(isSaving),
              ]}
            />
            <Text>minutes</Text>
          </HStack>
        </Section>

        <Section title="Tray Change Reminder">
          <Toggle
            isOn={settings.trayChangeReminderEnabled}
            label="Remind me when it is time to change trays"
            modifiers={[disabled(isSaving)]}
            onIsOnChange={(value) => updateSwitch('trayChangeReminderEnabled', value)}
          />
          <DatePicker
            displayedComponents={['hourAndMinute']}
            modifiers={[disabled(isSaving)]}
            onDateChange={(date) => {
              setTrayChangeReminderTime(date);
              setErrors((current) => ({ ...current, trayChangeReminderTime: undefined }));
              clearFeedback();
            }}
            selection={trayChangeReminderTime}
            title="Reminder time"
          />
        </Section>

        {saveError || saveMessage ? (
          <Section>
            {saveError ? <ValidationMessage message={saveError} /> : null}
            {saveMessage ? (
              <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
                {saveMessage}
              </Text>
            ) : null}
          </Section>
        ) : null}

        <Section>
          <ActionButton
            label={isSaving ? 'Saving…' : 'Save changes'}
            onPress={() => void saveSettings()}
            pending={isSaving}
          />
        </Section>
      </Form>
    </Host>
  );
}
