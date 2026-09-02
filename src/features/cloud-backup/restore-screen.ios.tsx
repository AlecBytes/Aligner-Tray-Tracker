import {
  Alert,
  Button,
  Form,
  Host,
  HStack,
  Image,
  Label,
  ProgressView,
  RNHostView,
  Section,
  Spacer,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  buttonStyle,
  disabled,
  font,
  foregroundStyle,
  frame,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
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
  listRecoveryPoints,
  restoreRecoveryPoint,
  type RecoveryPoint,
  type RecoveryPointCursor,
} from '@/features/cloud-backup/cloud-restore.ios';
import {
  cloudRestoreFailure,
  selectDefaultRecoveryPointId,
  type CloudRestoreFailure,
} from '@/features/cloud-backup/cloud-restore-core';
import { createCloudRestoreScreenOperation } from '@/features/cloud-backup/cloud-restore-screen-operation';
import { isCloudRestoreEligible } from '@/features/cloud-backup/restore-repository';
import { refreshWatchTrackerSnapshot } from '@/features/siri/aligner-tracker-intents';
import { useAppTheme } from '@/theme/use-app-theme';

type AppleAuthenticationModule = typeof import('expo-apple-authentication');
type EligibilityState = 'checking' | 'eligible' | 'ineligible' | 'failure';
type RecoveryListState =
  | { status: 'idle' }
  | { status: 'loading' }
  | {
      status: 'loaded';
      items: RecoveryPoint[];
      nextCursor: RecoveryPointCursor | null;
    }
  | { status: 'failure'; failure: CloudRestoreFailure };

const recoveryDateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function mergeRecoveryPoints(existing: RecoveryPoint[], next: RecoveryPoint[]) {
  const byId = new Map(existing.map((point) => [point.id, point]));
  for (const point of next) byId.set(point.id, point);
  return [...byId.values()];
}

export function RestoreScreen() {
  const db = useSQLiteContext();
  const navigation = useNavigation();
  const router = useRouter();
  const theme = useAppTheme();
  const colorScheme = useColorScheme();
  const mounted = useRef(false);
  const eligibilityStatus = useRef<EligibilityState>('checking');
  const authStatus = useRef<CloudAuthState['status']>('loading');
  const requestGeneration = useRef(0);
  const operationInProgress = useRef(false);
  const restoreOperation = useRef<ReturnType<
    typeof createCloudRestoreScreenOperation
  > | null>(null);
  const [eligibility, setEligibility] = useState<EligibilityState>('checking');
  const [authState, setAuthState] = useState<CloudAuthState>({ status: 'loading' });
  const [appleAuthentication, setAppleAuthentication] =
    useState<AppleAuthenticationModule | null>(null);
  const [authWorking, setAuthWorking] = useState(false);
  const [listState, setListState] = useState<RecoveryListState>({ status: 'idle' });
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [restoreWorking, setRestoreWorking] = useState(false);
  const [restoreFailure, setRestoreFailure] = useState<CloudRestoreFailure | null>(null);
  const [showReminderWarning, setShowReminderWarning] = useState(false);

  const loadFirstPage = useCallback(async () => {
    const generation = ++requestGeneration.current;
    setListState({ status: 'loading' });
    setSelectedId(null);
    setRestoreFailure(null);
    try {
      const page = await listRecoveryPoints(db);
      if (!mounted.current || generation !== requestGeneration.current) return;
      setListState({ status: 'loaded', ...page });
      setSelectedId(selectDefaultRecoveryPointId(page.items));
    } catch (error) {
      if (!mounted.current || generation !== requestGeneration.current) return;
      const failure = cloudRestoreFailure(error, 'listing');
      if (failure.kind === 'sessionExpired') {
        authStatus.current = 'signedOut';
        setAuthState({ status: 'signedOut' });
      }
      setListState({ status: 'failure', failure });
    }
  }, [db]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestGeneration.current += 1;
    };
  }, []);

  useEffect(() => {
    const operation = createCloudRestoreScreenOperation({
      perform: (point, signal) => restoreRecoveryPoint(db, point, { signal }),
      onStart: () => {
        operationInProgress.current = true;
        setRestoreWorking(true);
        setRestoreFailure(null);
      },
      onResult: (result) => {
        if (result.status === 'failure') {
          if (result.kind === 'sessionExpired') {
            authStatus.current = 'signedOut';
            setAuthState({ status: 'signedOut' });
          }
          if (result.kind === 'notEmpty') {
            eligibilityStatus.current = 'ineligible';
            setEligibility('ineligible');
          }
          setRestoreFailure(result);
          return;
        }
        void refreshWatchTrackerSnapshot();
        if (result.reminders === 'needsAttention') setShowReminderWarning(true);
        else router.replace('/tracker');
      },
      onFinish: () => {
        operationInProgress.current = false;
        setRestoreWorking(false);
      },
    });
    restoreOperation.current = operation;
    return () => {
      operation.dispose();
      if (restoreOperation.current === operation) restoreOperation.current = null;
    };
  }, [db, router]);

  useEffect(() => {
    navigation.setOptions({
      gestureEnabled: !restoreWorking,
      headerBackVisible: !restoreWorking,
    });
  }, [navigation, restoreWorking]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      eligibilityStatus.current = 'checking';
      setEligibility('checking');
      requestGeneration.current += 1;
      setListState({ status: 'idle' });
      setSelectedId(null);
      void isCloudRestoreEligible(db)
        .then((eligible) => {
          if (!active) return;
          const nextEligibility = eligible ? 'eligible' : 'ineligible';
          eligibilityStatus.current = nextEligibility;
          setEligibility(nextEligibility);
          if (eligible && authStatus.current === 'signedIn') void loadFirstPage();
        })
        .catch(() => {
          if (active) {
            eligibilityStatus.current = 'failure';
            setEligibility('failure');
          }
        });
      return () => {
        active = false;
      };
    }, [db, loadFirstPage]),
  );

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      const nextState = await loadCloudAuthState(db);
      if (!active) return;
      authStatus.current = nextState.status;
      setAuthState(nextState);
      if (nextState.status === 'signedIn' && eligibilityStatus.current === 'eligible') {
        void loadFirstPage();
      }

      if (nextState.status === 'signedIn' || nextState.status === 'signedOut') {
        const nextUnsubscribe = await subscribeToCloudAuthState(db, (updatedState) => {
          if (!active) return;
          authStatus.current = updatedState.status;
          setAuthState(updatedState);
          if (updatedState.status === 'signedIn' && eligibilityStatus.current === 'eligible') {
            void loadFirstPage();
          } else {
            requestGeneration.current += 1;
            setListState({ status: 'idle' });
            setSelectedId(null);
          }
        });
        if (active) unsubscribe = nextUnsubscribe;
        else nextUnsubscribe();
      }
    })();

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [db, loadFirstPage]);

  useEffect(() => {
    let active = true;
    void import('expo-apple-authentication')
      .then((module) => {
        if (active) setAppleAuthentication(module);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  async function handleSignIn() {
    if (operationInProgress.current) return;
    operationInProgress.current = true;
    setAuthWorking(true);
    setRestoreFailure(null);
    const result = await signInWithApple(db);
    operationInProgress.current = false;
    if (!mounted.current) return;
    if (result.status === 'signedIn') {
      authStatus.current = 'signedIn';
      setAuthState({ status: 'signedIn' });
      if (eligibilityStatus.current === 'eligible') void loadFirstPage();
    }
    if (result.status === 'failure') {
      setRestoreFailure({
        status: 'failure',
        kind: 'sessionExpired',
        message: result.message,
        retryable: true,
      });
    }
    setAuthWorking(false);
  }

  async function handleSignOut() {
    if (operationInProgress.current) return;
    operationInProgress.current = true;
    setAuthWorking(true);
    setRestoreFailure(null);
    const result = await signOutLocally(db);
    operationInProgress.current = false;
    if (!mounted.current) return;
    if (result.status === 'signedOut') {
      authStatus.current = 'signedOut';
      setAuthState({ status: 'signedOut' });
      requestGeneration.current += 1;
      setListState({ status: 'idle' });
      setSelectedId(null);
    } else {
      setRestoreFailure({
        status: 'failure',
        kind: 'sessionExpired',
        message: result.message,
        retryable: true,
      });
    }
    setAuthWorking(false);
  }

  async function loadOlder() {
    if (loadingMore || listState.status !== 'loaded' || !listState.nextCursor) return;
    const generation = requestGeneration.current;
    setLoadingMore(true);
    setRestoreFailure(null);
    try {
      const page = await listRecoveryPoints(db, listState.nextCursor);
      if (!mounted.current || generation !== requestGeneration.current) return;
      const items = mergeRecoveryPoints(listState.items, page.items);
      setListState({
        status: 'loaded',
        items,
        nextCursor: page.nextCursor,
      });
      setSelectedId((current) => current ?? selectDefaultRecoveryPointId(items));
    } catch (error) {
      if (!mounted.current || generation !== requestGeneration.current) return;
      const failure = cloudRestoreFailure(error, 'listing');
      if (failure.kind === 'sessionExpired') {
        authStatus.current = 'signedOut';
        setAuthState({ status: 'signedOut' });
      }
      setRestoreFailure(failure);
    } finally {
      if (mounted.current && generation === requestGeneration.current) setLoadingMore(false);
    }
  }

  function handleRestore() {
    if (listState.status !== 'loaded') return;
    const selected = listState.items.find((point) => point.id === selectedId);
    if (!selected?.supported) return;
    void restoreOperation.current?.start(selected);
  }

  function openRestoredTracker() {
    setShowReminderWarning(false);
    router.replace('/tracker');
  }

  const AppleAuthenticationButton = appleAuthentication?.AppleAuthenticationButton;
  const selectedPoint =
    listState.status === 'loaded'
      ? listState.items.find((point) => point.id === selectedId) ?? null
      : null;

  return (
    <Host seedColor={theme.primary} style={{ flex: 1 }}>
      <Form>
        <Section>
          <VStack alignment="leading" spacing={8}>
            <Text modifiers={[font({ textStyle: 'title2', weight: 'bold' })]}>
              Restore from Cloud Backup
            </Text>
            <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
              Restore treatment history and reminder settings onto this empty installation.
            </Text>
          </VStack>
        </Section>

        {eligibility === 'checking' ? (
          <Section>
            <ProgressView>
              <Text>Checking local data</Text>
            </ProgressView>
          </Section>
        ) : null}

        {eligibility === 'failure' ? (
          <Section title="Local data unavailable">
            <Label systemImage="exclamationmark.triangle" title="Restore cannot start" />
            <Text modifiers={[foregroundStyle(theme.error)]}>
              Your saved data could not be checked. Return and try again.
            </Text>
          </Section>
        ) : null}

        {eligibility === 'ineligible' ? (
          <Section title="Restore unavailable">
            <Label systemImage="internaldrive" title="Local treatment data already exists" />
            <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
              Cloud restore is available only on a new or empty installation. Existing treatment
              data is never replaced or merged.
            </Text>
            <ActionButton label="Open Tracker" onPress={() => router.replace('/tracker')} />
          </Section>
        ) : null}

        {eligibility === 'eligible' && authState.status === 'loading' ? (
          <Section title="Account">
            <ProgressView>
              <Text>Loading account status</Text>
            </ProgressView>
          </Section>
        ) : null}

        {eligibility === 'eligible' && authState.status === 'unavailable' ? (
          <Section title="Cloud Backup unavailable">
            <Label systemImage="icloud.slash" title="Restore unavailable" />
            <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
              {authState.message}
            </Text>
          </Section>
        ) : null}

        {eligibility === 'eligible' && authState.status === 'failure' ? (
          <Section title="Account status">
            <Label systemImage="exclamationmark.triangle" title="Could not load account" />
            <Text modifiers={[foregroundStyle(theme.error)]}>{authState.message}</Text>
            <ActionButton
              label="Try Again"
              onPress={() => {
                setAuthState({ status: 'loading' });
                void loadCloudAuthState(db).then((state) => {
                  if (!mounted.current) return;
                  authStatus.current = state.status;
                  setAuthState(state);
                  if (state.status === 'signedIn' && eligibilityStatus.current === 'eligible') {
                    void loadFirstPage();
                  }
                });
              }}
              prominent={false}
            />
          </Section>
        ) : null}

        {eligibility === 'eligible' && authState.status === 'signedOut' ? (
          <Section title="Sign in to restore">
            <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
              Sign in with the Apple account used to create your cloud backups.
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

        {eligibility === 'eligible' && authState.status === 'signedIn' ? (
          <Section title="Account">
            <Label systemImage="checkmark.circle" title="Signed in with Apple" />
            <ActionButton
              disabled={restoreWorking || loadingMore}
              label="Sign Out"
              onPress={() => void handleSignOut()}
              pending={authWorking}
              prominent={false}
            />
          </Section>
        ) : null}

        {eligibility === 'eligible' &&
        authState.status === 'signedIn' &&
        listState.status === 'loading' ? (
          <Section title="Recovery points">
            <ProgressView>
              <Text>Loading cloud backups</Text>
            </ProgressView>
          </Section>
        ) : null}

        {eligibility === 'eligible' &&
        authState.status === 'signedIn' &&
        listState.status === 'failure' ? (
          <Section title="Recovery points unavailable">
            <Label systemImage="exclamationmark.triangle" title="Could not load backups" />
            <Text modifiers={[foregroundStyle(theme.error)]}>{listState.failure.message}</Text>
            <ActionButton label="Try Again" onPress={() => void loadFirstPage()} prominent={false} />
          </Section>
        ) : null}

        {listState.status === 'loaded' && listState.items.length === 0 ? (
          <Section title="Recovery points">
            <Label systemImage="icloud" title="No completed backups found" />
            <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
              Continue with treatment setup to start tracking on this installation.
            </Text>
            <ActionButton
              label="Return to Setup"
              onPress={() => router.replace('/setup')}
              prominent={false}
            />
          </Section>
        ) : null}

        {listState.status === 'loaded' && listState.items.length > 0 ? (
          <Section title="Choose a recovery point">
            {listState.items.map((point) => {
              const selected = point.id === selectedId;
              return (
                <Button
                  key={point.id}
                  modifiers={[
                    buttonStyle('plain'),
                    disabled(!point.supported || restoreWorking),
                  ]}
                  onPress={() => setSelectedId(point.id)}>
                  <HStack
                    spacing={12}
                    modifiers={[
                      frame({ maxWidth: Infinity, minHeight: 52, alignment: 'leading' }),
                      padding({ vertical: 4 }),
                    ]}>
                    <Image
                      color={point.supported ? theme.primary : 'secondary'}
                      size={20}
                      systemName={
                        point.supported
                          ? selected
                            ? 'checkmark.circle.fill'
                            : 'circle'
                          : 'exclamationmark.circle'
                      }
                    />
                    <VStack alignment="leading" spacing={3}>
                      <Text>
                        {recoveryDateTimeFormatter.format(new Date(point.createdAt))}
                      </Text>
                      <Text
                        modifiers={[
                          font({ textStyle: 'caption' }),
                          foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                        ]}>
                        Aligner Tracker {point.appVersion}
                      </Text>
                      {!point.supported ? (
                        <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(theme.error)]}>
                          Update Aligner Tracker to restore this backup.
                        </Text>
                      ) : null}
                    </VStack>
                    <Spacer />
                  </HStack>
                </Button>
              );
            })}
            {listState.nextCursor ? (
              <ActionButton
                disabled={restoreWorking}
                label={loadingMore ? 'Loading Older Backups' : 'Load Older Backups'}
                onPress={() => void loadOlder()}
                pending={loadingMore}
                prominent={false}
              />
            ) : null}
          </Section>
        ) : null}

        {restoreFailure ? (
          <Section title="Cloud Backup issue">
            <Label systemImage="exclamationmark.triangle" title="Action incomplete" />
            <Text modifiers={[foregroundStyle(theme.error)]}>{restoreFailure.message}</Text>
          </Section>
        ) : null}

        {listState.status === 'loaded' && listState.items.length > 0 ? (
          <Section>
            <ActionButton
              disabled={!selectedPoint?.supported || loadingMore}
              label={restoreWorking ? 'Restoring Backup' : 'Restore Selected Backup'}
              onPress={handleRestore}
              pending={restoreWorking}
              systemImage={restoreWorking ? undefined : 'icloud.and.arrow.down'}
            />
            <Alert
              isPresented={showReminderWarning}
              onIsPresentedChange={(presented) => {
                setShowReminderWarning(presented);
                if (!presented && showReminderWarning) router.replace('/tracker');
              }}
              title="Data restored">
              <Alert.Trigger>
                <Text>{''}</Text>
              </Alert.Trigger>
              <Alert.Actions>
                <Button label="Open Tracker" onPress={openRestoredTracker} />
              </Alert.Actions>
              <Alert.Message>
                <Text>
                  Your treatment data was restored, but reminders need attention. Aligner Tracker
                  will try scheduling them again later.
                </Text>
              </Alert.Message>
            </Alert>
          </Section>
        ) : null}
      </Form>
    </Host>
  );
}
