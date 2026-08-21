import {
  Button,
  HStack,
  Image,
  ProgressView,
  Spacer,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityHint,
  accessibilityLabel,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  disabled,
  font,
  foregroundStyle,
  frame,
  monospacedDigit,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import type { ComponentProps } from 'react';
import { Platform } from 'react-native';

type NavigationRowProps = {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  secondaryValue?: string;
  systemImage?: ComponentProps<typeof Image>['systemName'];
};

type ActionButtonProps = {
  accessibilityHintText?: string;
  accessibilityLabelText?: string;
  disabled?: boolean;
  label: string;
  onPress: () => void;
  pending?: boolean;
  prominent?: boolean;
  systemImage?: ComponentProps<typeof Button>['systemImage'];
};

export function isLiquidGlassPlatform() {
  return Number.parseInt(String(Platform.Version), 10) >= 26;
}

export function ValidationMessage({ message }: { message?: string | null }) {
  if (!message) {
    return null;
  }

  return (
    <Text
      modifiers={[
        accessibilityLabel(`Error: ${message}`),
        font({ textStyle: 'caption' }),
        foregroundStyle('red'),
      ]}>
      {message}
    </Text>
  );
}

export function NavigationRow({
  disabled: isDisabled = false,
  label,
  onPress,
  secondaryValue,
  systemImage,
}: NavigationRowProps) {
  return (
    <Button
      modifiers={[buttonStyle('plain'), disabled(isDisabled)]}
      onPress={onPress}>
      <HStack
        spacing={10}
        modifiers={[
          frame({ maxWidth: Infinity, minHeight: 44, alignment: 'leading' }),
          padding({ vertical: 4 }),
        ]}>
        {systemImage ? <Image color="secondary" size={20} systemName={systemImage} /> : null}
        <Text>{label}</Text>
        <Spacer />
        {secondaryValue ? (
          <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
            {secondaryValue}
          </Text>
        ) : null}
        <Image color="secondary" size={14} systemName="chevron.right" />
      </HStack>
    </Button>
  );
}

export function ActionButton({
  accessibilityHintText,
  accessibilityLabelText,
  disabled: isDisabled = false,
  label,
  onPress,
  pending = false,
  prominent = true,
  systemImage,
}: ActionButtonProps) {
  const liquidGlass = isLiquidGlassPlatform();

  return (
    <Button
      label={systemImage ? label : undefined}
      systemImage={systemImage}
      modifiers={[
        buttonStyle(
          prominent
            ? liquidGlass
              ? 'glassProminent'
              : 'borderedProminent'
            : liquidGlass
              ? 'glass'
              : 'bordered',
        ),
        buttonBorderShape('roundedRectangle', 12),
        controlSize('large'),
        disabled(isDisabled || pending),
        frame({ maxWidth: Infinity, minHeight: 44 }),
        ...(accessibilityLabelText ? [accessibilityLabel(accessibilityLabelText)] : []),
        ...(accessibilityHintText ? [accessibilityHint(accessibilityHintText)] : []),
      ]}
      onPress={onPress}>
      {systemImage ? undefined : (
        <HStack spacing={8} modifiers={[frame({ maxWidth: Infinity })]}>
          <Spacer />
          {pending ? <ProgressView /> : null}
          <Text modifiers={[font({ weight: 'semibold' })]}>{label}</Text>
          <Spacer />
        </HStack>
      )}
    </Button>
  );
}

export function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <HStack spacing={16} alignment="top">
      <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
        {label}
      </Text>
      <Spacer />
      <Text modifiers={[font({ weight: 'semibold' }), monospacedDigit()]}>{value}</Text>
    </HStack>
  );
}

export function CenteredState({
  actionLabel,
  message,
  onAction,
  title,
}: {
  actionLabel?: string;
  message: string;
  onAction?: () => void;
  title: string;
}) {
  return (
    <VStack
      alignment="leading"
      spacing={16}
      modifiers={[
        frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'center' }),
        padding({ all: 24 }),
      ]}>
      <Text modifiers={[font({ textStyle: 'title2', weight: 'bold' })]}>{title}</Text>
      <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <ActionButton label={actionLabel} onPress={onAction} prominent={false} />
      ) : null}
    </VStack>
  );
}
