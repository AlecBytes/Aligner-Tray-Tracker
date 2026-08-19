import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { AppText } from '@/components/app-text';
import type { FormKeyboardInputProps } from '@/components/form-keyboard-navigation';
import { radius, spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

type TreatmentFormFieldProps = Pick<TextInputProps, 'inputMode' | 'keyboardType'> & {
  disabled?: boolean;
  error?: string;
  label: string;
  navigation: FormKeyboardInputProps;
  onChangeText: (value: string) => void;
  value: string;
};

export function TreatmentFormField({
  disabled = false,
  error,
  label,
  navigation,
  ...inputProps
}: TreatmentFormFieldProps) {
  const theme = useAppTheme();

  return (
    <View style={styles.field}>
      <AppText>{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        autoCorrect={false}
        editable={!disabled}
        selectTextOnFocus
        style={[
          styles.input,
          {
            backgroundColor: theme.surface,
            borderColor: error ? theme.error : theme.border,
            color: theme.text,
            opacity: disabled ? 0.65 : 1,
          },
        ]}
        {...navigation}
        {...inputProps}
      />
      {error ? (
        <AppText accessibilityLiveRegion="polite" style={{ color: theme.error }} variant="caption">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.sm,
  },
  input: {
    borderRadius: radius.md,
    borderWidth: 1,
    fontSize: 18,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
