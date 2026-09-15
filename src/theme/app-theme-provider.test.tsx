import React from 'react';

import { AppThemeProvider } from './app-theme-provider';
import { useAppThemeState } from './use-app-theme';
import { getSelectedThemeKey, updateSelectedThemeKey } from './theme-preference-repository';
import type { ThemeKey } from './tokens';

const mockDb = {};
jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));
jest.mock('./theme-preference-repository', () => ({
  getSelectedThemeKey: jest.fn(),
  updateSelectedThemeKey: jest.fn(),
}));

type TestNode = { props: {
  effectiveThemeKey: ThemeKey;
  savedThemeKey: ThemeKey;
  selectTheme: (key: ThemeKey) => Promise<void>;
} };
const renderer = jest.requireActual('react-test-renderer') as {
  act: (callback: () => void | Promise<void>) => Promise<void>;
  create: (element: React.ReactElement) => {
    root: { findByType: (type: string) => TestNode };
    unmount: () => void;
  };
};

function ThemeProbe() {
  const themeState = useAppThemeState();
  return React.createElement('ThemeState', {
    effectiveThemeKey: themeState.effectiveThemeKey,
    savedThemeKey: themeState.savedThemeKey,
    selectTheme: themeState.selectTheme,
  });
}

describe('AppThemeProvider', () => {
  beforeEach(() => {
    jest.mocked(getSelectedThemeKey).mockReset().mockResolvedValue('blue');
    jest.mocked(updateSelectedThemeKey).mockReset().mockResolvedValue(undefined);
  });

  it('uses the saved local theme without paid access and preserves write rollback', async () => {
    let tree!: ReturnType<typeof renderer.create>;
    await renderer.act(async () => {
      tree = renderer.create(<AppThemeProvider><ThemeProbe /></AppThemeProvider>);
    });

    expect(tree.root.findByType('ThemeState').props).toMatchObject({
      effectiveThemeKey: 'blue',
      savedThemeKey: 'blue',
    });

    await renderer.act(async () => {
      await tree.root.findByType('ThemeState').props.selectTheme('teal');
    });
    expect(tree.root.findByType('ThemeState').props).toMatchObject({
      effectiveThemeKey: 'teal',
      savedThemeKey: 'teal',
    });

    jest.mocked(updateSelectedThemeKey).mockRejectedValueOnce(new Error('write failed'));
    await renderer.act(async () => {
      await expect(tree.root.findByType('ThemeState').props.selectTheme('pink')).rejects.toThrow(
        'write failed',
      );
    });
    expect(tree.root.findByType('ThemeState').props).toMatchObject({
      effectiveThemeKey: 'teal',
      savedThemeKey: 'teal',
    });

    await renderer.act(async () => tree.unmount());
  });
});
