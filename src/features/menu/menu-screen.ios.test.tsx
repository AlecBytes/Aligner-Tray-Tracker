import React from 'react';

import { MenuScreen } from './menu-screen.ios';

const mockPush = jest.fn();

jest.mock('@/features/retainer/use-tracking-mode', () => ({ useTrackingMode: () => ({ mode: { kind: 'treatment', treatmentId: 1 } }) }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));
jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => ({}) }));
jest.mock('@expo/ui/swift-ui', () => {
  const Alert = ({ children }: React.PropsWithChildren) => children;
  Alert.Actions = 'AlertActions';
  Alert.Message = 'AlertMessage';
  Alert.Trigger = 'AlertTrigger';
  return { Alert, Button: 'Button', Form: 'Form', Host: 'Host', Section: 'Section', Text: 'Text' };
});
jest.mock('@expo/ui/swift-ui/modifiers', () => ({
  disabled: (value: unknown) => ({ disabled: value }),
  foregroundStyle: (value: unknown) => ({ foregroundStyle: value }),
}));
jest.mock('@/components/expo-ui-components', () => ({ NavigationRow: 'NavigationRow' }));
jest.mock('@/config/release-features', () => ({
  releaseFeatures: { cloudBackup: false, paidAccess: false },
}));
jest.mock('@/config/support-config', () => ({ isSupportEnabled: false }));
jest.mock('@/features/cloud-auth/cloud-auth-service.ios', () => ({ clearLocalCloudSession: jest.fn() }));
jest.mock('@/features/notifications/local-notifications', () => ({ reconcileLocalNotifications: jest.fn() }));
jest.mock('@/features/reset/reset-app-repository', () => ({ resetAppData: jest.fn() }));
jest.mock('@/features/reset/reset-app', () => ({ resetAppWithLocalSession: jest.fn() }));
jest.mock('@/features/siri/aligner-tracker-intents', () => ({ refreshWatchTrackerSnapshot: jest.fn() }));
jest.mock('@/theme/use-app-theme', () => ({
  useAppTheme: () => ({ error: 'red', primary: 'purple' }),
  useAppThemeState: () => ({ reloadTheme: jest.fn() }),
}));

type TestNode = { props: { label?: string; onPress?: () => void } };
const renderer = jest.requireActual('react-test-renderer') as {
  act: (callback: () => void | Promise<void>) => Promise<void>;
  create: (element: React.ReactElement) => {
    root: { findAllByType: (type: string) => TestNode[] };
    unmount: () => void;
  };
};

it('shows Themes in the production-style menu when paid access is disabled', async () => {
  let tree!: ReturnType<typeof renderer.create>;
  await renderer.act(async () => { tree = renderer.create(<MenuScreen />); });
  const themes = tree.root.findAllByType('NavigationRow').find((row) => row.props.label === 'Themes');

  expect(themes).toBeDefined();
  themes?.props.onPress?.();
  expect(mockPush).toHaveBeenCalledWith('/themes');

  await renderer.act(async () => tree.unmount());
});

it('orders the primary menu actions by workflow priority', async () => {
  let tree!: ReturnType<typeof renderer.create>;
  await renderer.act(async () => { tree = renderer.create(<MenuScreen />); });

  const labels = tree.root.findAllByType('NavigationRow').map((row) => row.props.label);
  expect(labels).toEqual([
    'Notifications',
    'Edit In/Out Times',
    'Share Progress',
    'Statistics',
    'Themes',
    'Retainer Mode',
    'Treatment Plan',
    'Help',
  ]);

  await renderer.act(async () => tree.unmount());
});
