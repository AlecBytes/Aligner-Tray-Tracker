import React from 'react';

import MainLayout from '../app/(main)/_layout';

jest.mock('expo-router', () => {
  const Stack = ({ children }: React.PropsWithChildren) => children;
  Stack.Screen = 'StackScreen';
  return { Stack };
});
jest.mock('@/config/release-features', () => ({
  releaseFeatures: { cloudBackup: false, paidAccess: false },
}));
jest.mock('@/features/treatment/treatment-route-gate', () => ({
  TreatmentRouteGate: ({ children }: React.PropsWithChildren) => children,
}));
jest.mock('@/theme/use-app-theme', () => ({
  useAppTheme: () => ({ background: 'white', border: 'gray', surface: 'white', text: 'black' }),
}));

type TestNode = { props: { name?: string; redirect?: boolean } };
const renderer = jest.requireActual('react-test-renderer') as {
  act: (callback: () => void | Promise<void>) => Promise<void>;
  create: (element: React.ReactElement) => {
    root: { findAllByType: (type: string) => TestNode[] };
    unmount: () => void;
  };
};

it('keeps Themes routable when paid access is disabled', async () => {
  let tree!: ReturnType<typeof renderer.create>;
  await renderer.act(async () => { tree = renderer.create(<MainLayout />); });
  const screens = tree.root.findAllByType('StackScreen');
  const route = (name: string) => screens.find((screen) => screen.props.name === name)?.props;

  expect(route('themes')?.redirect).toBeUndefined();
  expect(route('premium')?.redirect).toBe(true);
  expect(route('premium-support')?.redirect).toBe(true);

  await renderer.act(async () => tree.unmount());
});
