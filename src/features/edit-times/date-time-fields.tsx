import { StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { radius, spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

type DateTimeFieldsProps = {
  dateValue: string;
  disabled?: boolean;
  label: string;
  onChangeDate: (value: string) => void;
  onChangeTime: (value: string) => void;
  timeValue: string;
};

export function DateTimeFields({
  dateValue,
  disabled = false,
  label,
  onChangeDate,
  onChangeTime,
  timeValue,
}: DateTimeFieldsProps) {
  const theme = useAppTheme();
  const inputStyle = [
    styles.input,
    {
      backgroundColor: theme.surface,
      borderColor: theme.border,
      color: theme.text,
      opacity: disabled ? 0.65 : 1,
    },
  ];

  return (
    <View style={styles.field}>
      <AppText>{label}</AppText>
      <View style={styles.row}>
        <View style={styles.dateField}>
          <AppText muted variant="caption">Date</AppText>
          <TextInput
            accessibilityLabel={`${label} date`}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!disabled}
            onChangeText={onChangeDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.textMuted}
            selectTextOnFocus
            style={inputStyle}
            value={dateValue}
          />
        </View>
        <View style={styles.timeField}>
          <AppText muted variant="caption">Time</AppText>
          <TextInput
            accessibilityLabel={`${label} time`}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!disabled}
            onChangeText={onChangeTime}
            placeholder="HH:MM:SS"
            placeholderTextColor={theme.textMuted}
            selectTextOnFocus
            style={inputStyle}
            value={timeValue}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dateField: {
    flex: 1.25,
    gap: spacing.xs,
  },
  field: {
    gap: spacing.sm,
  },
  input: {
    borderRadius: radius.md,
    borderWidth: 1,
    fontSize: 17,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  timeField: {
    flex: 1,
    gap: spacing.xs,
  },
});

