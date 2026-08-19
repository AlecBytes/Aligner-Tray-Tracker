import { createRef, useCallback, useMemo, useState } from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';

import { AppText } from '@/components/app-text';
import { spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

export type FormKeyboardInputProps = Pick<
  TextInputProps,
  | 'inputAccessoryViewID'
  | 'onFocus'
  | 'onSubmitEditing'
  | 'returnKeyType'
  | 'submitBehavior'
> & {
  ref: React.RefObject<TextInput | null>;
};

type FormKeyboardAccessoryProps = {
  accessoryId: string;
  activeIndex: number;
  fieldCount: number;
  focusField: (index: number) => void;
};

function FormKeyboardAccessory({
  accessoryId,
  activeIndex,
  fieldCount,
  focusField,
}: FormKeyboardAccessoryProps) {
  const theme = useAppTheme();

  if (Platform.OS !== 'ios') {
    return null;
  }

  const hasPrevious = activeIndex > 0;
  const hasNext = activeIndex < fieldCount - 1;

  return (
    <InputAccessoryView nativeID={accessoryId}>
      <View
        style={[
          styles.accessory,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}>
        {fieldCount > 1 ? (
          <View style={styles.accessoryNavigation}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !hasPrevious }}
              disabled={!hasPrevious}
              onPress={() => focusField(activeIndex - 1)}
              style={styles.accessoryButton}>
              <AppText style={{ color: hasPrevious ? theme.primary : theme.textMuted }}>
                Previous
              </AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !hasNext }}
              disabled={!hasNext}
              onPress={() => focusField(activeIndex + 1)}
              style={styles.accessoryButton}>
              <AppText style={{ color: hasNext ? theme.primary : theme.textMuted }}>
                Next
              </AppText>
            </Pressable>
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={Keyboard.dismiss}
          style={[styles.accessoryButton, styles.doneButton]}>
          <AppText style={{ color: theme.primary, fontWeight: '700' }}>Done</AppText>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

export function useFormKeyboardNavigation(fieldCount: number, accessoryId: string) {
  const inputRefs = useMemo(
    () => Array.from({ length: fieldCount }, () => createRef<TextInput>()),
    [fieldCount],
  );
  const [activeIndex, setActiveIndex] = useState(0);

  const focusField = useCallback(
    (index: number) => {
      inputRefs[index]?.current?.focus();
    },
    [inputRefs],
  );

  const getInputProps = useCallback(
    (index: number): FormKeyboardInputProps => {
      const isLastField = index === fieldCount - 1;

      return {
        inputAccessoryViewID: Platform.OS === 'ios' ? accessoryId : undefined,
        onFocus: () => setActiveIndex(index),
        onSubmitEditing: () => {
          if (isLastField) {
            Keyboard.dismiss();
            return;
          }

          focusField(index + 1);
        },
        ref: inputRefs[index],
        returnKeyType: isLastField ? 'done' : 'next',
        submitBehavior: isLastField ? 'blurAndSubmit' : 'submit',
      };
    },
    [accessoryId, fieldCount, focusField, inputRefs],
  );

  return {
    accessory: (
      <FormKeyboardAccessory
        accessoryId={accessoryId}
        activeIndex={activeIndex}
        fieldCount={fieldCount}
        focusField={focusField}
      />
    ),
    focusField,
    getInputProps,
  };
}

const styles = StyleSheet.create({
  accessory: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  accessoryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  accessoryNavigation: {
    flexDirection: 'row',
  },
  doneButton: {
    marginLeft: 'auto',
  },
});
