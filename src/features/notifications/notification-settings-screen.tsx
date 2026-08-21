import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { AppLoadingScreen } from '@/components/app-loading-screen';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { useFormKeyboardNavigation } from '@/components/form-keyboard-navigation';
import type { Settings } from '@/db/schema';
import {
  getLocalNotificationPermissionState,
  type LocalNotificationPermissionState,
  reconcileLocalNotifications,
} from '@/features/notifications/local-notifications';
import {
  formatReminderTime,
  type NotificationSettingsFormValues,
  type NotificationSettingsValidationErrors,
  validateNotificationSettings,
} from '@/features/notifications/notification-settings-model';
import {
  getNotificationSettings,
  updateNotificationSettings,
} from '@/features/notifications/notification-settings-repository';
import { radius, spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

type ReminderSwitchProps = {
  disabled: boolean;
  label: string;
  onValueChange: (value: boolean) => void;
  value: boolean;
};

function ReminderSwitch({ disabled, label, onValueChange, value }: ReminderSwitchProps) {
  const theme = useAppTheme();

  return (
    <View style={styles.switchRow}>
      <AppText style={styles.switchLabel}>{label}</AppText>
      <Switch
        accessibilityLabel={label}
        disabled={disabled}
        ios_backgroundColor={theme.border}
        onValueChange={onValueChange}
        trackColor={{ false: theme.border, true: theme.primary }}
        value={value}
      />
    </View>
  );
}

function permissionMessage(permission: LocalNotificationPermissionState) {
  switch (permission) {
    case 'granted':
      return 'Notifications are allowed by your device.';
    case 'denied':
      return 'Notifications are blocked by your device. Your reminder preferences are still saved.';
    case 'undetermined':
      return 'Your device will ask for permission when you save an enabled reminder.';
    case 'unavailable':
      return Platform.OS === 'web'
        ? 'Local notifications are unavailable on web. Your reminder preferences are still saved.'
        : 'Notification status is unavailable. Your reminder preferences are still saved.';
  }
}

export function NotificationSettingsScreen() {
  const db = useSQLiteContext();
  const theme = useAppTheme();
  const keyboardNavigation = useFormKeyboardNavigation(3, 'notification-settings-keyboard');
  const saveInProgress = useRef(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [values, setValues] = useState<NotificationSettingsFormValues | null>(null);
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

          setSettings(persistedSettings);
          setValues({
            outReminderMinutes: String(persistedSettings.outReminderMinutes),
            outPersistentReminderIntervalMinutes: String(
              persistedSettings.outPersistentReminderIntervalMinutes,
            ),
            trayChangeReminderTime: formatReminderTime(
              persistedSettings.trayChangeReminderHour,
              persistedSettings.trayChangeReminderMinute,
            ),
          });
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
    }, [loadSettings]),
  );

  function updateValue(field: keyof NotificationSettingsFormValues, value: string) {
    setValues((current) => (current === null ? current : { ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSaveError(null);
    setSaveMessage(null);
  }

  function updateSwitch(field: 'outReminderEnabled' | 'trayChangeReminderEnabled', value: boolean) {
    setSettings((current) => (current === null ? current : { ...current, [field]: value }));
    setSaveError(null);
    setSaveMessage(null);
  }

  async function saveSettings() {
    if (saveInProgress.current || settings === null || values === null) {
      return;
    }

    const validation = validateNotificationSettings(values);

    if (!validation.success) {
      setErrors(validation.errors);
      const firstInvalidField = [
        validation.errors.outReminderMinutes,
        validation.errors.outPersistentReminderIntervalMinutes,
        validation.errors.trayChangeReminderTime,
      ].findIndex(Boolean);

      if (firstInvalidField >= 0) {
        requestAnimationFrame(() => keyboardNavigation.focusField(firstInvalidField));
      }
      return;
    }

    const nextSettings: Settings = { ...settings, ...validation.data };
    saveInProgress.current = true;
    setIsSaving(true);
    setErrors({});
    setSaveError(null);
    setSaveMessage(null);

    try {
      await updateNotificationSettings(db, nextSettings);
      setSettings(nextSettings);
      setValues({
        outReminderMinutes: String(nextSettings.outReminderMinutes),
        outPersistentReminderIntervalMinutes: String(
          nextSettings.outPersistentReminderIntervalMinutes,
        ),
        trayChangeReminderTime: formatReminderTime(
          nextSettings.trayChangeReminderHour,
          nextSettings.trayChangeReminderMinute,
        ),
      });
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

  if (settings === null || values === null) {
    if (isLoading) {
      return <AppLoadingScreen message="Loading notification settings…" />;
    }

    return (
      <AppScreen scrollable>
        <View style={styles.message}>
          <AppText variant="heading">Notifications unavailable</AppText>
          <AppText muted>{loadError ?? 'Notification settings could not be loaded.'}</AppText>
        </View>
      </AppScreen>
    );
  }

  const canOpenDeviceSettings = Platform.OS !== 'web' && permission !== 'granted';

  return (
    <AppScreen keyboardAccessory={keyboardNavigation.accessory} scrollable>
      <View style={[styles.permissionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <AppText muted variant="caption">
          {permissionMessage(permission)}
        </AppText>
        {canOpenDeviceSettings ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void openDeviceSettings()}
            style={({ pressed }) => [
              styles.settingsButton,
              { backgroundColor: pressed ? theme.border : theme.background, borderColor: theme.border },
            ]}>
            <AppText>Open device settings</AppText>
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <AppText variant="heading">OUT Reminder</AppText>
        <ReminderSwitch
          disabled={isSaving}
          label="Remind me when trays have been out too long"
          onValueChange={(value) => updateSwitch('outReminderEnabled', value)}
          value={settings.outReminderEnabled}
        />
        <View style={styles.field}>
          <AppText>Remind me after</AppText>
          <View style={styles.inputRow}>
            <TextInput
              accessibilityLabel="OUT reminder minutes"
              editable={!isSaving}
              inputMode="numeric"
              keyboardType="number-pad"
              onChangeText={(value) => updateValue('outReminderMinutes', value)}
              selectTextOnFocus
              style={[
                styles.numberInput,
                {
                  backgroundColor: theme.background,
                  borderColor: errors.outReminderMinutes ? theme.error : theme.border,
                  color: theme.text,
                },
              ]}
              value={values.outReminderMinutes}
              {...keyboardNavigation.getInputProps(0)}
            />
            <AppText>minutes</AppText>
          </View>
          {errors.outReminderMinutes ? (
            <AppText accessibilityLiveRegion="polite" style={{ color: theme.error }} variant="caption">
              {errors.outReminderMinutes}
            </AppText>
          ) : null}
        </View>
        <View style={styles.field}>
          <AppText>Persistent reminder interval</AppText>
          <View style={styles.inputRow}>
            <TextInput
              accessibilityLabel="Persistent OUT reminder interval minutes"
              editable={!isSaving}
              inputMode="numeric"
              keyboardType="number-pad"
              onChangeText={(value) =>
                updateValue('outPersistentReminderIntervalMinutes', value)
              }
              selectTextOnFocus
              style={[
                styles.numberInput,
                {
                  backgroundColor: theme.background,
                  borderColor: errors.outPersistentReminderIntervalMinutes
                    ? theme.error
                    : theme.border,
                  color: theme.text,
                },
              ]}
              value={values.outPersistentReminderIntervalMinutes}
              {...keyboardNavigation.getInputProps(1)}
            />
            <AppText>minutes</AppText>
          </View>
          {errors.outPersistentReminderIntervalMinutes ? (
            <AppText
              accessibilityLiveRegion="polite"
              style={{ color: theme.error }}
              variant="caption">
              {errors.outPersistentReminderIntervalMinutes}
            </AppText>
          ) : null}
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <AppText variant="heading">Tray Change Reminder</AppText>
        <ReminderSwitch
          disabled={isSaving}
          label="Remind me when it is time to change trays"
          onValueChange={(value) => updateSwitch('trayChangeReminderEnabled', value)}
          value={settings.trayChangeReminderEnabled}
        />
        <View style={styles.field}>
          <AppText>Reminder time</AppText>
          <TextInput
            accessibilityLabel="Tray change reminder time"
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!isSaving}
            onChangeText={(value) => updateValue('trayChangeReminderTime', value)}
            placeholder="9:00 AM"
            placeholderTextColor={theme.textMuted}
            selectTextOnFocus
            style={[
              styles.timeInput,
              {
                backgroundColor: theme.background,
                borderColor: errors.trayChangeReminderTime ? theme.error : theme.border,
                color: theme.text,
              },
            ]}
            value={values.trayChangeReminderTime}
            {...keyboardNavigation.getInputProps(2)}
          />
          {errors.trayChangeReminderTime ? (
            <AppText accessibilityLiveRegion="polite" style={{ color: theme.error }} variant="caption">
              {errors.trayChangeReminderTime}
            </AppText>
          ) : null}
        </View>
      </View>

      {saveError ? (
        <AppText accessibilityLiveRegion="polite" style={{ color: theme.error }}>
          {saveError}
        </AppText>
      ) : null}
      {saveMessage ? (
        <AppText accessibilityLiveRegion="polite" muted>
          {saveMessage}
        </AppText>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={isSaving}
        onPress={() => void saveSettings()}
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
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.sm,
  },
  inputRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  message: {
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
  },
  numberInput: {
    borderRadius: radius.md,
    borderWidth: 1,
    fontSize: 18,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    width: 104,
  },
  permissionCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  saveButton: {
    alignItems: 'center',
    borderRadius: radius.md,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  section: {
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  settingsButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  switchLabel: {
    flex: 1,
    paddingRight: spacing.md,
  },
  switchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeInput: {
    borderRadius: radius.md,
    borderWidth: 1,
    fontSize: 18,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
