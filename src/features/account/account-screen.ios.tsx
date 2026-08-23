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
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { useColorScheme } from 'react-native';

import { ActionButton } from '@/components/expo-ui-components';
import {
  loadCloudAuthState,
  signInWithApple,
  signOutLocally,
  subscribeToCloudAuthState,
  type CloudAuthState,
} from '@/features/cloud-auth/cloud-auth-service.ios';
import { useAppTheme } from '@/theme/use-app-theme';

type AppleAuthenticationModule = typeof import('expo-apple-authentication');

export function AccountScreen() {
  const db = useSQLiteContext();
  const theme = useAppTheme();
  const colorScheme = useColorScheme();
  const operationInProgress = useRef(false);
  const [appleAuthentication, setAppleAuthentication] =
    useState<AppleAuthenticationModule | null>(null);
  const [state, setState] = useState<CloudAuthState>({ status: 'loading' });
  const [isWorking, setIsWorking] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);

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

  async function handleSignIn() {
    if (operationInProgress.current) return;
    operationInProgress.current = true;
    setIsWorking(true);
    setOperationError(null);

    const result = await signInWithApple(db);
    if (result.status === 'signedIn') setState({ status: 'signedIn' });
    if (result.status === 'failure') setOperationError(result.message);

    operationInProgress.current = false;
    setIsWorking(false);
  }

  async function handleSignOut() {
    if (operationInProgress.current) return;
    operationInProgress.current = true;
    setIsWorking(true);
    setOperationError(null);

    const result = await signOutLocally(db);
    if (result.status === 'signedOut') setState({ status: 'signedOut' });
    else setOperationError(result.message);

    operationInProgress.current = false;
    setIsWorking(false);
  }

  async function reload() {
    setState({ status: 'loading' });
    setOperationError(null);
    setState(await loadCloudAuthState(db));
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
              Connect an Apple account for future cloud backup and restore. Signing in now only
              connects the account; no backup will run.
            </Text>
            {isWorking || !appleAuthentication || !AppleAuthenticationButton ? (
              <ProgressView>
                <Text>{isWorking ? 'Signing in' : 'Loading Sign in with Apple'}</Text>
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
            <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
              Backup and restore are not available in this phase. No backup has been created.
            </Text>
            <ActionButton
              disabled={isWorking}
              label="Sign Out"
              onPress={() => void handleSignOut()}
              pending={isWorking}
              prominent={false}
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
