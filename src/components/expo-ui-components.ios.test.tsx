import React from 'react';

import { NavigationRow } from './expo-ui-components';

jest.mock('@expo/ui/swift-ui', () => ({
  Button: 'Button',
  HStack: 'HStack',
  Image: 'Image',
  ProgressView: 'ProgressView',
  Spacer: 'Spacer',
  Text: 'Text',
  VStack: 'VStack',
}));

jest.mock('@expo/ui/swift-ui/modifiers', () => ({
  ...Object.fromEntries(
    [
      'accessibilityHint',
      'accessibilityLabel',
      'buttonBorderShape',
      'buttonStyle',
      'controlSize',
      'disabled',
      'font',
      'foregroundStyle',
      'frame',
      'monospacedDigit',
      'padding',
    ].map((name) => [name, (value: unknown) => ({ [name]: value })]),
  ),
  contentShape: (shape: unknown) => ({ contentShape: shape }),
  shapes: { rectangle: () => ({ shape: 'rectangle' }) },
}));

type TestNode = {
  props: {
    modifiers?: Record<string, unknown>[];
    onPress?: () => void;
  };
};

const renderer = jest.requireActual('react-test-renderer') as {
  act: (callback: () => void | Promise<void>) => Promise<void>;
  create: (element: React.ReactElement) => {
    root: { findByType: (type: string) => TestNode };
    unmount: () => void;
  };
};

describe('NavigationRow on iOS', () => {
  it('uses the full row as its tap target while preserving button behavior', async () => {
    const onPress = jest.fn();
    let tree!: ReturnType<typeof renderer.create>;

    await renderer.act(async () => {
      tree = renderer.create(
        <NavigationRow disabled label="Treatment Plan" onPress={onPress} systemImage="list.bullet" />,
      );
    });

    const button = tree.root.findByType('Button');
    const row = tree.root.findByType('HStack');

    expect(button.props.modifiers).toContainEqual({ buttonStyle: 'plain' });
    expect(button.props.modifiers).toContainEqual({ disabled: true });
    expect(row.props.modifiers).toContainEqual({ contentShape: { shape: 'rectangle' } });

    button.props.onPress?.();
    expect(onPress).toHaveBeenCalledTimes(1);

    await renderer.act(async () => tree.unmount());
  });
});
