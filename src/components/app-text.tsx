import type { ComponentProps } from 'react';
import { StyleSheet, Text } from 'react-native';

import { useAppTheme } from '@/theme/use-app-theme';

type TextVariant = 'body' | 'caption' | 'heading' | 'title';

type AppTextProps = ComponentProps<typeof Text> & {
  muted?: boolean;
  variant?: TextVariant;
};

export function AppText({ muted = false, style, variant = 'body', ...props }: AppTextProps) {
  const theme = useAppTheme();

  return (
    <Text
      {...props}
      style={[styles.base, styles[variant], { color: muted ? theme.textMuted : theme.text }, style]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    fontSize: 17,
    lineHeight: 25,
  },
  body: {},
  caption: {
    fontSize: 14,
    lineHeight: 20,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 38,
  },
});
