import React from 'react';

import { themeKeys, themeNames } from '@/theme/tokens';
import { ThemesScreen } from './themes-screen.ios';

const mockSelectTheme = jest.fn();

jest.mock('@expo/ui/swift-ui', () => ({
  Button: 'Button',
  Form: 'Form',
  Host: 'Host',
  HStack: 'HStack',
  Rectangle: 'Rectangle',
  Section: 'Section',
  Spacer: 'Spacer',
  Text: 'Text',
  VStack: 'VStack',
}));
jest.mock('@expo/ui/swift-ui/modifiers', () => ({
  ...Object.fromEntries(
    [
      'accessibilityHint',
      'accessibilityLabel',
      'buttonStyle',
      'foregroundStyle',
      'frame',
    ].map((name) => [name, (value: unknown) => ({ [name]: value })]),
  ),
  contentShape: (shape: unknown) => ({ contentShape: shape }),
  shapes: { rectangle: () => ({ shape: 'rectangle' }) },
}));
jest.mock('@/components/expo-ui-components', () => ({
  ValidationMessage: 'ValidationMessage',
}));
jest.mock('@/theme/use-app-theme', () => ({
  useAppTheme: () => ({ primary: '#580FBD' }),
  useAppThemeState: () => ({ savedThemeKey: 'default', selectTheme: mockSelectTheme }),
}));

type TestNode = {
  props: {
    children?: unknown;
    footer?: React.ReactElement<{ message?: string | null }>;
    label?: string;
    message?: string | null;
    modifiers?: Record<string, unknown>[];
    onPress?: () => void;
    title?: string;
  };
};

const renderer = jest.requireActual('react-test-renderer') as {
  act: (callback: () => void | Promise<void>) => Promise<void>;
  create: (element: React.ReactElement) => {
    root: { findAllByType: (type: string) => TestNode[] };
    unmount: () => void;
  };
};

describe('ThemesScreen on iOS', () => {
  beforeEach(() => mockSelectTheme.mockReset().mockResolvedValue(undefined));

  it('shows every palette as available without purchase controls', async () => {
    let tree!: ReturnType<typeof renderer.create>;
    await renderer.act(async () => { tree = renderer.create(<ThemesScreen />); });

    const buttons = tree.root.findAllByType('Button');
    expect(buttons).toHaveLength(themeKeys.length);
    for (const key of themeKeys) {
      expect(buttons.some((button) => button.props.modifiers?.some(
        (modifier) => modifier.accessibilityLabel === `${themeNames[key]}, ${key === 'default' ? 'selected' : 'available'}`,
      ))).toBe(true);
    }
    expect(tree.root.findAllByType('Section').map((section) => section.props.title)).not.toContain('Premium access');
    expect(buttons.map((button) => button.props.label)).not.toContain('Restore Purchases');
    expect(buttons.map((button) => button.props.label)).not.toContain('Manage Subscription');

    await renderer.act(async () => tree.unmount());
  });

  it('applies every palette directly and reports persistence failures', async () => {
    let tree!: ReturnType<typeof renderer.create>;
    await renderer.act(async () => { tree = renderer.create(<ThemesScreen />); });
    const buttons = tree.root.findAllByType('Button');

    for (const button of buttons) {
      await renderer.act(async () => { button.props.onPress?.(); });
    }
    expect(mockSelectTheme.mock.calls.map(([key]) => key)).toEqual(themeKeys);

    mockSelectTheme.mockRejectedValueOnce(new Error('write failed'));
    await renderer.act(async () => { buttons[1].props.onPress?.(); });
    expect(tree.root.findAllByType('Section')[0]?.props.footer?.props.message).toBe(
      'Your theme could not be saved. Please try again.',
    );

    await renderer.act(async () => tree.unmount());
  });
});
