import { Alert, Button, Form, Host, Section, Text } from '@expo/ui/swift-ui';
import { disabled, foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useRef, useState } from 'react';

import { NavigationRow } from '@/components/expo-ui-components';
import { isSupportEnabled } from '@/config/support-config';
import { clearLocalCloudSession } from '@/features/cloud-auth/cloud-auth-service.ios';
import { reconcileLocalNotifications } from '@/features/notifications/local-notifications';
import { resetAppData } from '@/features/reset/reset-app-repository';
import { resetAppWithLocalSession } from '@/features/reset/reset-app';
import { refreshWatchTrackerSnapshot } from '@/features/siri/aligner-tracker-intents';
import { useAppTheme } from '@/theme/use-app-theme';

export function MenuScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useAppTheme();
  const resetInProgress = useRef(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetConfirmationPresented, setResetConfirmationPresented] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  async function resetApp() {
    if (resetInProgress.current) {
      return;
    }

    resetInProgress.current = true;
    setIsResetting(true);
    setResetError(null);
    setResetConfirmationPresented(false);

    try {
      await resetAppWithLocalSession({
        clearLocalSession: () => clearLocalCloudSession(db),
        resetLocalData: () => resetAppData(db),
        reconcileNotifications: () => reconcileLocalNotifications(db),
      });
      void refreshWatchTrackerSnapshot();
      router.replace('/setup');
    } catch {
      resetInProgress.current = false;
      setIsResetting(false);
      setResetError('Your local session and app data could not be reset. Please try again.');
    }
  }

  return (
    <Host seedColor={theme.primary} style={{ flex: 1 }}>
      <Form>
        <Section>
          <NavigationRow
            label="Cloud Backup"
            onPress={() => router.push('/account')}
            systemImage="person.circle"
          />
          <NavigationRow
            label="Treatment Plan"
            onPress={() => router.push('/treatment-plan')}
            systemImage="list.bullet.clipboard"
          />
          <NavigationRow
            label="Notifications"
            onPress={() => router.push('/notifications')}
            systemImage="bell"
          />
          <NavigationRow
            label="Edit In/Out Times"
            onPress={() => router.push('/edit-times')}
            systemImage="clock.arrow.circlepath"
          />
          <NavigationRow
            label="Statistics"
            onPress={() => router.push('/statistics')}
            systemImage="chart.bar"
          />
          <NavigationRow
            label="Share Progress"
            onPress={() => router.push('/share-progress')}
            systemImage="square.and.arrow.up"
          />
        </Section>

        {isSupportEnabled ? (
          <Section title="Development">
            <NavigationRow
              label="Support Aligner Tracker (Preview)"
              onPress={() => router.push('/support')}
              systemImage="heart"
            />
          </Section>
        ) : null}

        <Section>
          <NavigationRow
            label="Help"
            onPress={() => router.push('/help')}
            systemImage="questionmark.circle"
          />
        </Section>

        <Section
          footer={
            resetError ? (
              <Text modifiers={[foregroundStyle(theme.error)]}>{resetError}</Text>
            ) : undefined
          }>
          <Alert
            isPresented={resetConfirmationPresented}
            onIsPresentedChange={setResetConfirmationPresented}
            title="Reset App?">
            <Alert.Trigger>
              <Button
                label={isResetting ? 'Resetting App…' : 'Reset App'}
                modifiers={[disabled(isResetting)]}
                onPress={() => setResetConfirmationPresented(true)}
                role="destructive"
                systemImage="trash"
              />
            </Alert.Trigger>
            <Alert.Actions>
              <Button label="Reset" onPress={() => void resetApp()} role="destructive" />
              <Button label="Cancel" role="cancel" />
            </Alert.Actions>
            <Alert.Message>
              <Text>
                This action will delete all the data you created in the app. It can not be undone.
              </Text>
            </Alert.Message>
          </Alert>
        </Section>
      </Form>
    </Host>
  );
}
