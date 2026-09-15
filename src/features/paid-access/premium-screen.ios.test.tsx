import React from 'react';

import { PremiumScreen } from './premium-screen.ios';

const mockLoadPackages = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ dismiss: jest.fn() }) }));
jest.mock('@expo/ui/swift-ui', () => ({
  Button: 'Button', Form: 'Form', Host: 'Host', Section: 'Section', Text: 'Text',
}));
jest.mock('@expo/ui/swift-ui/modifiers', () => ({
  disabled: (value: unknown) => ({ disabled: value }),
  foregroundStyle: (value: unknown) => ({ foregroundStyle: value }),
}));
jest.mock('@/components/expo-ui-components', () => ({
  ActionButton: 'ActionButton', ValidationMessage: 'ValidationMessage',
}));
jest.mock('@/theme/use-app-theme', () => ({ useAppTheme: () => ({ primary: 'purple' }) }));
jest.mock('./paid-access-config', () => ({ paidAccessConfig: {} }));
jest.mock('./paid-access-provider', () => ({
  usePaidAccess: () => ({
    access: { expirationAt: null, hasPremiumAccess: false, isLifetime: false },
    loadPackages: mockLoadPackages,
    manage: jest.fn(),
    packages: [],
    packagesUnavailable: true,
    purchase: jest.fn(),
    restore: jest.fn(),
  }),
}));

type TestNode = { props: { children?: unknown } };
const renderer = jest.requireActual('react-test-renderer') as {
  act: (callback: () => void | Promise<void>) => Promise<void>;
  create: (element: React.ReactElement) => {
    root: { findAllByType: (type: string) => TestNode[] };
    unmount: () => void;
  };
};

it('presents Premium Support without claiming that purchases unlock themes', async () => {
  let tree!: ReturnType<typeof renderer.create>;
  await renderer.act(async () => { tree = renderer.create(<PremiumScreen />); });
  const copy = tree.root.findAllByType('Text').map((node) => node.props.children).join(' ');

  expect(copy).toContain('Get Premium Support');
  expect(copy).toContain('Themes and core tracking remain free.');
  expect(copy).not.toContain('Unlock all currently available color themes');
  expect(mockLoadPackages).toHaveBeenCalledTimes(1);

  await renderer.act(async () => tree.unmount());
});
