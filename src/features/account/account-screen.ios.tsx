import {
  Form,
  Host,
  Label,
  ProgressView,
  RNHostView,
  Section,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import { font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useColorScheme } from 'react-native';

import { ActionButton } from '@/components/expo-ui-components';
import {
  loadCloudAuthState,
  signInWithApple,
  signOutLocally,
  subscribeToCloudAuthState,
  type CloudAuthState,
} from '@/features/cloud-auth/cloud-auth-service.ios';
import {
  loadLatestCompletedBackup,
  performManualBackup,
} from '@/features/cloud-backup/manual-backup.ios';
import {
  manualBackupFailure,
  type ManualBackupFailure,
} from '@/features/cloud-backup/manual-backup-core';
import { createManualBackupScreenOperation } from '@/features/cloud-backup/manual-backup-screen-operation';
import { useAppTheme } from '@/theme/use-app-theme';

type AppleAuthenticationModule = typeof import('expo-apple-authentication');
type LatestBackupState =
  | { status: 'loading' }
  | { status: 'loaded'; completedAt: string | null }
  | { status: 'failure'; message: string };
type BackupFeedback =
  | { status: 'created'; message: string }
  | { status: 'current'; message: string }
  | ManualBackupFailure;

const backupDateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function AccountScreen() {
  const db = useSQLiteContext();
  const theme = useAppTheme();
  const colorScheme = useColorScheme();
  const mounted = useRef(false);
  const operationInProgress = useRef(false);
  const backupOperation = useRef<ReturnType<typeof createManualBackupScreenOperation> | null>(null);
  const statusRequestGeneration = useRef(0);
  const [appleAuthentication, setAppleAuthentication] =
    useState<AppleAuthenticationModule | null>(null);
  const [state, setState] = useState<CloudAuthState>({ status: 'loading' });
  const [authWorking, setAuthWorking] = useState(false);
  const [backupWorking, setBackupWorking] = useState(false);
  const [latestBackup, setLatestBackup] = useState<LatestBackupState>({ status: 'loading' });
  const [backupFeedback, setBackupFeedback] = useState<BackupFeedback | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      statusRequestGeneration.current += 1;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      const nextState = await loadCloudAuthState(db);
      if (!mounted) return;
      setState(nextState);

      if (nextState.status === 'signedIn' || nextState.status === 'signedOut') {
        const nextUnsubscribe = await subscribeToCloudAuthState(db, (updatedState) => {
          if (mounted) setState(updatedState);
        });
        if (mounted) unsubscribe = nextUnsubscribe;
        else nextUnsubscribe();
      }
    })();

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [db]);

  useEffect(() => {
    let mounted = true;

    void import('expo-apple-authentication')
      .then((module) => {
        if (mounted) setAppleAuthentication(module);
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const operation = createManualBackupScreenOperation({
      perform: () => performManualBackup(db),
      onStart: () => {
        operationInProgress.current = true;
        setBackupWorking(true);
        setBackupFeedback(null);
        setOperationError(null);
      },
      onResult: (result) => {
        if (result.status === 'failure') {
          if (result.kind === 'sessionExpired') {
            setState({ status: 'signedOut' });
            setOperationError(result.message);
          } else {
            setBackupFeedback(result);
          }
          return;
        }

        statusRequestGeneration.current += 1;
        setLatestBackup({ status: 'loaded', completedAt: result.completedAt });
        setBackupFeedback(
          result.status === 'created'
            ? { status: 'created', message: 'Backup completed successfully.' }
            : { status: 'current', message: 'Your cloud backup is already current.' },
        );
      },
      onFinish: () => {
        operationInProgress.current = false;
        setBackupWorking(false);
      },
    });
    backupOperation.current = operation;

    return () => {
      operation.dispose();
      if (backupOperation.current === operation) backupOperation.current = null;
    };
  }, [db]);

  const refreshBackupStatus = useCallback(async () => {
    const requestGeneration = ++statusRequestGeneration.current;
    setLatestBackup({ status: 'loading' });

    try {
      const completedAt = await loadLatestCompletedBackup(db);
      if (!mounted.current || requestGeneration !== statusRequestGeneration.current) return;
      setLatestBackup({ status: 'loaded', completedAt });
    } catch (error) {
      if (!mounted.current || requestGeneration !== statusRequestGeneration.current) return;
      const failure = manualBackupFailure(error, 'status');
      if (failure.kind === 'sessionExpired') {
        setState({ status: 'signedOut' });
        setOperationError(failure.message);
        return;
      }
      setLatestBackup({ status: 'failure', message: failure.message });
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      if (state.status === 'signedIn') void refreshBackupStatus();
      return () => {
        statusRequestGeneration.current += 1;
      };
    }, [refreshBackupStatus, state.status]),
  );

  async function handleSignIn() {
    if (operationInProgress.current) return;
    operationInProgress.current = true;
    setAuthWorking(true);
    setOperationError(null);

    const result = await signInWithApple(db);
    operationInProgress.current = false;
    if (!mounted.current) return;
    if (result.status === 'signedIn') setState({ status: 'signedIn' });
    if (result.status === 'failure') setOperationError(result.message);
    setAuthWorking(false);
  }

  async function handleSignOut() {
    if (operationInProgress.current) return;
    operationInProgress.current = true;
    setAuthWorking(true);
    setOperationError(null);

    const result = await signOutLocally(db);
    operationInProgress.current = false;
    if (!mounted.current) return;
    if (result.status === 'signedOut') setState({ status: 'signedOut' });
    else setOperationError(result.message);
    setAuthWorking(false);
  }

  async function reload() {
    setState({ status: 'loading' });
    setOperationError(null);
    const nextState = await loadCloudAuthState(db);
    if (mounted.current) setState(nextState);
  }

  function handleBackUpNow() {
    if (operationInProgress.current) return;
    void backupOperation.current?.start();
  }

  const AppleAuthenticationButton = appleAuthentication?.AppleAuthenticationButton;

  return (
    <Host seedColor={theme.primary} style={{ flex: 1 }}>
      <Form>
        <Section>
          <VStack alignment="leading" spacing={8}>
            <Text modifiers={[font({ textStyle: 'title2', weight: 'bold' })]}>Cloud Backup</Text>
            <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
              Tracking stays local and works without an account or network connection.
            </Text>
          </VStack>
        </Section>

        {state.status === 'loading' ? (
          <Section title="Account">
            <ProgressView>
              <Text>Loading account status</Text>
            </ProgressView>
          </Section>
        ) : null}

        {state.status === 'unavailable' ? (
          <Section title="Unavailable">
            <Label systemImage="icloud.slash" title="Cloud Backup unavailable" />
            <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
              {state.message}
            </Text>
          </Section>
        ) : null}

        {state.status === 'failure' ? (
          <Section title="Account status">
            <Label systemImage="exclamationmark.triangle" title="Could not load account" />
            <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
              {state.message}
            </Text>
            <ActionButton label="Try Again" onPress={() => void reload()} prominent={false} />
          </Section>
        ) : null}

        {state.status === 'signedOut' ? (
          <Section title="Optional account">
            <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
              Connect an Apple account to create private cloud backups. Signing in does not upload
              anything until you choose Back Up Now.
            </Text>
            {authWorking || !appleAuthentication || !AppleAuthenticationButton ? (
              <ProgressView>
                <Text>{authWorking ? 'Signing in' : 'Loading Sign in with Apple'}</Text>
              </ProgressView>
            ) : (
              <RNHostView matchContents>
                <AppleAuthenticationButton
                  buttonStyle={
                    colorScheme === 'dark'
                      ? appleAuthentication.AppleAuthenticationButtonStyle.WHITE
                      : appleAuthentication.AppleAuthenticationButtonStyle.BLACK
                  }
                  buttonType={appleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                  cornerRadius={8}
                  onPress={() => void handleSignIn()}
                  style={{ width: 240, height: 44 }}
                />
              </RNHostView>
            )}
          </Section>
        ) : null}

        {state.status === 'signedIn' ? (
          <Section title="Account">
            <Label systemImage="checkmark.circle" title="Signed in with Apple" />
            <ActionButton
              disabled={authWorking || backupWorking}
              label="Sign Out"
              onPress={() => void handleSignOut()}
              pending={authWorking}
              prominent={false}
            />
          </Section>
        ) : null}

        {state.status === 'signedIn' ? (
          <Section title="Backup">
            {latestBackup.status === 'loading' ? (
              <ProgressView>
                <Text>Loading backup status</Text>
              </ProgressView>
            ) : null}

            {latestBackup.status === 'loaded' ? (
              <VStack alignment="leading" spacing={4}>
                <Text>Last successful backup</Text>
                <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
                  {latestBackup.completedAt
                    ? backupDateTimeFormatter.format(new Date(latestBackup.completedAt))
                    : 'No completed backups yet.'}
                </Text>
              </VStack>
            ) : null}

            {latestBackup.status === 'failure' ? (
              <VStack alignment="leading" spacing={8}>
                <Label systemImage="exclamationmark.triangle" title="Status unavailable" />
                <Text modifiers={[foregroundStyle(theme.error)]}>{latestBackup.message}</Text>
                <ActionButton
                  disabled={authWorking || backupWorking}
                  label="Refresh Status"
                  onPress={() => void refreshBackupStatus()}
                  prominent={false}
                />
              </VStack>
            ) : null}

            {backupFeedback ? (
              backupFeedback.status === 'failure' ? (
                <VStack alignment="leading" spacing={8}>
                  <Label systemImage="exclamationmark.triangle" title="Backup incomplete" />
                  <Text modifiers={[foregroundStyle(theme.error)]}>{backupFeedback.message}</Text>
                </VStack>
              ) : (
                <Label
                  systemImage={backupFeedback.status === 'created' ? 'checkmark.circle' : 'checkmark.icloud'}
                  title={backupFeedback.message}
                />
              )
            ) : null}

            <ActionButton
              disabled={authWorking || backupWorking}
              label={
                backupWorking
                  ? 'Backing Up'
                  : backupFeedback?.status === 'failure'
                    ? 'Try Backup Again'
                    : 'Back Up Now'
              }
              onPress={handleBackUpNow}
              pending={backupWorking}
              systemImage={backupWorking ? undefined : 'icloud.and.arrow.up'}
            />
          </Section>
        ) : null}

        {operationError ? (
          <Section>
            <Text modifiers={[foregroundStyle(theme.error)]}>{operationError}</Text>
          </Section>
        ) : null}
      </Form>
    </Host>
  );
}
