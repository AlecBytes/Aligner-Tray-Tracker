import {
  Button,
  ConfirmationDialog,
  Host,
  HStack,
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
  disabled,
  font,
  foregroundStyle,
  frame,
  keyboardType,
  onSubmit,
  padding,
  submitLabel,
  textInputAutocapitalization,
} from '@expo/ui/swift-ui/modifiers';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';

import { AppLoadingScreen } from '@/components/app-loading-screen';
import {
  ActionButton,
  CenteredState,
  isLiquidGlassPlatform,
  ValidationMessage,
} from '@/components/expo-ui-components';
import { reconcileLocalNotifications } from '@/features/notifications/local-notifications';
import { createTrackerReadModel } from '@/features/tracker/tracker-calculations';
import type { TrackerSnapshot } from '@/features/tracker/tracker-model';
import { getTrackerSnapshot } from '@/features/tracker/tracker-repository';
import { changeTray } from '@/features/tray-change/tray-change-repository';
import {
  getNextTrayNumber,
  getPreviousTrayNumber,
  validateTrayNumber,
} from '@/features/tray-change/change-tray-validation';
import { useAppTheme } from '@/theme/use-app-theme';

export function ChangeTrayScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useAppTheme();
  const manualTrayNumber = useNativeState('');
  const manualTrayNumberRef = useRef<TextFieldRef>(null);
  const changeInProgress = useRef(false);
  const [snapshot, setSnapshot] = useState<TrackerSnapshot | null>(null);
  const [readAt, setReadAt] = useState(0);
  const [pendingTrayNumber, setPendingTrayNumber] = useState<number | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isChanging, setIsChanging] = useState(false);

  const readTracker = useCallback(async () => {
    const timestamp = Date.now();
    const persistedSnapshot = await getTrackerSnapshot(db, timestamp);
    return { persistedSnapshot, timestamp };
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setIsLoading(true);
      void readTracker()
        .then(({ persistedSnapshot, timestamp }) => {
          if (!active) {
            return;
          }
          setSnapshot(persistedSnapshot);
          setReadAt(timestamp);
          setChangeError(persistedSnapshot === null ? 'No active treatment was found.' : null);
        })
        .catch(() => {
          if (active) {
            setChangeError('The current tray could not be loaded.');
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
    }, [readTracker]),
  );

  if (snapshot === null) {
    if (isLoading) {
      return <AppLoadingScreen />;
    }
    return (
      <Host seedColor={theme.primary} style={{ flex: 1 }}>
        <CenteredState
          actionLabel="Back to tracker"
          message={changeError ?? 'No active treatment was found.'}
          onAction={() => router.back()}
          title="Change tray unavailable"
        />
      </Host>
    );
  }

  const currentSnapshot = snapshot;
  const tracker = createTrackerReadModel(currentSnapshot, readAt);
  const previousTrayNumber = getPreviousTrayNumber(tracker.currentTrayNumber);
  const nextTrayNumber = getNextTrayNumber(tracker.currentTrayNumber, tracker.totalTrays);

  function requestTrayChange(trayNumber: number) {
    if (changeInProgress.current) {
      return;
    }
    setPendingTrayNumber(trayNumber);
    setValidationError(null);
    setChangeError(null);
  }

  function requestManualTrayChange() {
    const validation = validateTrayNumber(
      manualTrayNumber.get(),
      tracker.totalTrays,
      tracker.currentTrayNumber,
    );
    if (!validation.success) {
      setValidationError(validation.error);
      setPendingTrayNumber(null);
      return;
    }
    void manualTrayNumberRef.current?.blur();
    requestTrayChange(validation.data);
  }

  async function confirmTrayChange() {
    if (changeInProgress.current || pendingTrayNumber === null) {
      return;
    }
    changeInProgress.current = true;
    setIsChanging(true);
    setChangeError(null);
    try {
      await changeTray(db, {
        currentTrayPeriodId: currentSnapshot.trayPeriodId,
        trayNumber: pendingTrayNumber,
      });
      void reconcileLocalNotifications(db);
      router.dismissTo('/tracker');
    } catch {
      setChangeError('The tray could not be changed. Your previous tray is unchanged.');
      changeInProgress.current = false;
      setIsChanging(false);
    }
  }

  const confirmationMessage =
    tracker.currentStatus === 'IN'
      ? `Changing trays will mark tray ${tracker.currentTrayNumber} OUT and start tray ${pendingTrayNumber} OUT.`
      : `Your trays are OUT. Start tray ${pendingTrayNumber} now? The new tray will remain OUT until you mark it IN.`;
  const secondaryStyle = buttonStyle(isLiquidGlassPlatform() ? 'glass' : 'bordered');

  return (
    <Host seedColor={theme.primary} style={{ flex: 1 }}>
      <ConfirmationDialog
        isPresented={pendingTrayNumber !== null}
        onIsPresentedChange={(isPresented) => {
          if (!isPresented && !isChanging) {
            setPendingTrayNumber(null);
          }
        }}
        title={`Start tray ${pendingTrayNumber ?? ''}?`}>
        <ConfirmationDialog.Trigger>
          <VStack
            alignment="leading"
            spacing={16}
            modifiers={[
              frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading' }),
              padding({ all: 16 }),
            ]}>
            <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
              Current tray: {tracker.currentTrayNumber} / {tracker.totalTrays}
            </Text>

            <HStack spacing={12}>
              <Button
                label="Previous"
                modifiers={[
                  secondaryStyle,
                  disabled(previousTrayNumber === null || isChanging),
                  frame({ maxWidth: Infinity, minHeight: 44 }),
                ]}
                onPress={() => {
                  if (previousTrayNumber !== null) {
                    requestTrayChange(previousTrayNumber);
                  }
                }}
              />
              <Button
                label="Next"
                modifiers={[
                  secondaryStyle,
                  disabled(nextTrayNumber === null || isChanging),
                  frame({ maxWidth: Infinity, minHeight: 44 }),
                ]}
                onPress={() => {
                  if (nextTrayNumber !== null) {
                    requestTrayChange(nextTrayNumber);
                  }
                }}
              />
            </HStack>

            <VStack alignment="leading" spacing={8}>
              <Text modifiers={[font({ weight: 'semibold' })]}>Enter tray number</Text>
              <HStack spacing={12}>
                <TextField
                  onTextChange={() => {
                    setValidationError(null);
                    setPendingTrayNumber(null);
                  }}
                  placeholder={`1–${tracker.totalTrays}`}
                  ref={manualTrayNumberRef}
                  text={manualTrayNumber}
                  modifiers={[
                    accessibilityLabel('Tray number'),
                    autocorrectionDisabled(),
                    keyboardType('numeric'),
                    textInputAutocapitalization('never'),
                    submitLabel('done'),
                    // Expo UI invokes this callback only after a native submit event.
                    // eslint-disable-next-line react-hooks/refs
                    onSubmit(requestManualTrayChange),
                    disabled(isChanging),
                    frame({ maxWidth: Infinity }),
                  ]}
                />
                <Button
                  label="Select"
                  modifiers={[
                    buttonStyle(isLiquidGlassPlatform() ? 'glassProminent' : 'borderedProminent'),
                    disabled(isChanging),
                  ]}
                  onPress={requestManualTrayChange}
                />
              </HStack>
              <ValidationMessage message={validationError} />
            </VStack>

            {changeError ? <ValidationMessage message={changeError} /> : null}
            <Spacer />
            <ActionButton
              disabled={isChanging}
              label="Back to tracker"
              onPress={() => router.dismissTo('/tracker')}
              prominent={false}
            />
          </VStack>
        </ConfirmationDialog.Trigger>
        <ConfirmationDialog.Message>
          <Text>{confirmationMessage}</Text>
        </ConfirmationDialog.Message>
        <ConfirmationDialog.Actions>
          <Button
            label={isChanging ? 'Changing…' : 'Confirm change'}
            modifiers={[disabled(isChanging)]}
            onPress={() => void confirmTrayChange()}
          />
          <Button
            label="Cancel"
            role="cancel"
            modifiers={[disabled(isChanging)]}
            onPress={() => setPendingTrayNumber(null)}
          />
        </ConfirmationDialog.Actions>
      </ConfirmationDialog>
    </Host>
  );
}
