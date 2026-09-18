import React from 'react';
import { RetainerSettingsScreen } from './retainer-settings-screen.ios';

const mockSwitch = jest.fn();
let mockActive = false;
jest.mock('./use-retainer-settings', () => ({
  enableMessage: 'Complete your treatment.',
  disableMessage: 'Start another treatment.',
  useRetainerSettings: () => ({
    settings: { bedtime_enabled: 1, bedtime_minutes: 1320, morning_enabled: 1, morning_minutes: 420, automatic_enabled: 0, automatic_minutes: 420, automatic_effective_at: 0 },
    mode: { kind: mockActive ? 'retainer' : 'treatment' },
    error: null, busy: false, permission: 'granted', switchMode: mockSwitch, save: jest.fn(),
  }),
}));
jest.mock('@expo/ui/swift-ui', () => {
  const React = jest.requireActual('react');
  const Alert = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => React.createElement('NativeAlert', props, children);
  Alert.Trigger = 'AlertTrigger'; Alert.Actions = 'AlertActions'; Alert.Message = 'AlertMessage';
  return { Alert, Button: 'Button', DatePicker: 'DatePicker', Form: 'Form', Host: 'Host', Section: 'Section', Text: 'Text', Toggle: 'Toggle' };
});
jest.mock('@expo/ui/swift-ui/modifiers', () => ({ disabled: (value: boolean) => ({ disabled: value }) }));
jest.mock('@/theme/use-app-theme', () => ({ useAppTheme: () => ({ primary: 'purple' }) }));
jest.mock('@/components/app-loading-screen', () => ({ AppLoadingScreen: 'Loading' }));
const renderer = jest.requireActual('react-test-renderer');
beforeEach(() => { mockActive = false; mockSwitch.mockClear(); });
it.each([false, true])('requires confirmation before changing mode from active=%s', async (active) => {
  mockActive = active;
  let tree: any;
  await renderer.act(async () => { tree = renderer.create(<RetainerSettingsScreen />); });
  const toggle = tree.root.findAllByType('Toggle')[0];
  expect(tree.root.findByType('AlertTrigger').findByType('Toggle')).toBe(toggle);
  await renderer.act(async () => toggle.props.onIsOnChange(!active));
  expect(tree.root.findByType('NativeAlert').props.isPresented).toBe(true);
  expect(toggle.props.isOn).toBe(active);
  expect(mockSwitch).not.toHaveBeenCalled();
  await renderer.act(async () => tree.root.findAllByType('Button').find((node: any) => node.props.label === 'Cancel').props.onPress());
  expect(tree.root.findByType('NativeAlert').props.isPresented).toBe(false);
  expect(mockSwitch).not.toHaveBeenCalled();
  await renderer.act(async () => toggle.props.onIsOnChange(!active));
  await renderer.act(async () => tree.root.findAllByType('Button').find((node: any) => node.props.label !== 'Cancel').props.onPress());
  expect(mockSwitch).toHaveBeenCalledTimes(1);
  await renderer.act(async () => tree.unmount());
});
