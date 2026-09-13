import React from 'react';
import { TrackerScreen } from './tracker-screen.ios';
import { clearTrackerSessionHistory } from './tracker-history-session';
import type { TrackerSnapshot } from './tracker-model';

let mockFocus: () => () => void;
let mockBlur: () => void;
let mockForeground: (state: string) => void;
let mockExternal: () => void;
let mockPersisted: TrackerSnapshot | null;
const mockRead = jest.fn(async () => mockPersisted);
const mockEnsure = jest.fn();
const mockUndo = jest.fn();
const mockRedo = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (callback: () => () => void) => {
    const react = jest.requireActual('react') as typeof React;
    react.useEffect(() => {
      mockFocus = callback;
      mockBlur = callback();
      return () => mockBlur();
    }, [callback]);
  },
}));
jest.mock('expo-sqlite', () => {
  const db = {};
  return { useSQLiteContext: () => db };
});
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  native.AppState.addEventListener = (_: string, listener: typeof mockForeground) => {
    mockForeground = listener;
    return { remove: jest.fn() };
  };
  return native;
});
jest.mock('@expo/ui/swift-ui', () => ({
  Button: 'Button', Host: 'Host', HStack: 'HStack', Image: 'Image', Spacer: 'Spacer', Text: 'Text', VStack: 'VStack',
}));
jest.mock('@expo/ui/swift-ui/modifiers', () => ({
  ...Object.fromEntries([
    'accessibilityHidden', 'accessibilityHint', 'accessibilityLabel', 'aspectRatio', 'background', 'buttonBorderShape', 'buttonStyle',
    'contentTransition', 'controlSize', 'disabled', 'font', 'foregroundStyle', 'frame', 'lineLimit',
    'minimumScaleFactor', 'monospacedDigit', 'padding', 'resizable',
  ].map(name => [name, (value: unknown) => ({ [name]: value })])),
  shapes: { roundedRectangle: () => ({}) },
}));
jest.mock('expo-asset', () => ({
  useAssets: () => [
    [{ localUri: 'file:///clear-aligner.png' }, { localUri: 'file:///teeth.png' }],
    undefined,
  ],
}));
jest.mock('@/components/app-loading-screen', () => ({ AppLoadingScreen: 'AppLoadingScreen' }));
jest.mock('@/components/expo-ui-components', () => ({
  ActionButton: 'ActionButton', CenteredState: 'CenteredState', ValidationMessage: 'ValidationMessage',
  isLiquidGlassPlatform: () => true,
}));
jest.mock('@/theme/use-app-theme', () => ({ useAppTheme: () => ({ primary: 'purple', surface: 'white' }) }));
jest.mock('@/features/notifications/local-notifications', () => ({ reconcileLocalNotifications: jest.fn() }));
jest.mock('@/features/siri/aligner-tracker-intents', () => ({
  isNativeWearStatusAvailable: () => true,
  ensureWearStatus: (...args: unknown[]) => mockEnsure(...args),
  refreshWatchTrackerSnapshot: jest.fn(),
  addWearStatusChangedListener: (listener: () => void) => {
    mockExternal = listener;
    return { remove: jest.fn() };
  },
}));
jest.mock('./tracker-repository', () => ({
  getTrackerSnapshot: () => mockRead(),
  undoWearStatus: (...args: unknown[]) => mockUndo(...args),
  redoWearStatus: (...args: unknown[]) => mockRedo(...args),
}));

type TestNode = { props: { label?: string; onPress?: () => void; message?: string; children?: unknown; modifiers?: Record<string, unknown>[]; uiImage?: string } };
const renderer = jest.requireActual('react-test-renderer') as {
  act: (callback: () => void | Promise<void>) => Promise<void>;
  create: (element: React.ReactElement) => {
    root: { findAllByType: (type: string) => TestNode[] };
    unmount: () => void;
  };
};
let tree: ReturnType<typeof renderer.create>;
const act = renderer.act;
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const text = () => tree.root.findAllByType('Text').map(node => node.props.children).join(' ');
const error = () => tree.root.findAllByType('ValidationMessage')[0]?.props.message;
function button(label: string) {
  return tree.root.findAllByType('Button').find(node => label === 'toggle'
    ? node.props.modifiers?.some(modifier => String(modifier.accessibilityLabel).startsWith('Trays are'))
    : node.props.label === label)!;
}
function accessibleButton(label: string) {
  return tree.root.findAllByType('Button').find(node =>
    node.props.modifiers?.some(modifier => modifier.accessibilityLabel === label),
  )!;
}
const press = (label: string) => act(async () => { button(label).props.onPress!(); });

beforeEach(() => {
  jest.clearAllMocks();
  mockRead.mockReset().mockImplementation(async () => mockPersisted);
  mockEnsure.mockReset().mockImplementation(async (status: 'IN' | 'OUT', timestamp: number) => {
    const punch = { id: mockPersisted!.punches.length + 1, status, timestamp };
    mockPersisted = { ...mockPersisted!, punches: [...mockPersisted!.punches, punch] };
    return { outcome: 'changed', notificationStatus: 'reconciled', punch };
  });
  mockUndo.mockReset().mockImplementation(async () => {
    mockPersisted = { ...mockPersisted!, punches: mockPersisted!.punches.slice(0, -1) };
  });
  mockRedo.mockReset().mockImplementation(async (_db, action) => {
    mockPersisted = { ...mockPersisted!, punches: [...mockPersisted!.punches, action.punch] };
    return action.punch;
  });
  clearTrackerSessionHistory();
  mockPersisted = {
    currentTrayNumber: 30, totalTrays: 45, daysPerTray: 7,
    trayPeriodId: 1, trayStartedAt: Date.now() - 86400000,
    punches: [{ id: 1, status: 'OUT', timestamp: Date.now() - 3600000 }],
  };
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });
async function mount() { await act(async () => { tree = renderer.create(<TrackerScreen />); }); }

it('shows the bundled aligner as a decorative image in the tracker toggle', async () => {
  await mount();
  const image = tree.root.findAllByType('Image').find(
    node => node.props.uiImage === 'file:///clear-aligner.png',
  )!;
  expect(image.props.uiImage).toBe('file:///clear-aligner.png');
  expect(image.props.modifiers).toContainEqual({ frame: { maxWidth: 260, maxHeight: 152 } });
  expect(image.props.modifiers).toContainEqual({ accessibilityHidden: undefined });
});

it('opens the treatment plan from the bundled teeth shortcut', async () => {
  await mount();
  const image = tree.root.findAllByType('Image').find(
    node => node.props.uiImage === 'file:///teeth.png',
  )!;
  const treatmentPlanButton = accessibleButton('Open treatment plan');

  expect(image.props.modifiers).toContainEqual({ frame: { width: 32, height: 32 } });
  expect(image.props.modifiers).toContainEqual({ accessibilityHidden: undefined });
  expect(treatmentPlanButton.props.modifiers).toContainEqual({
    frame: { minWidth: 44, minHeight: 44 },
  });

  await act(async () => treatmentPlanButton.props.onPress!());
  expect(mockPush).toHaveBeenCalledWith('/treatment-plan');
});

it('keeps IN after Menu navigation, then records OUT on the next tap', async () => {
  await mount();
  await press('toggle');
  expect(text()).toContain('TRAYS ARE IN');
  await press('Menu');
  expect(mockPush).toHaveBeenCalledWith('/menu');
  await act(async () => mockBlur());
  await act(async () => { mockBlur = mockFocus(); });
  expect(text()).toContain('TRAYS ARE IN');
  await press('toggle');
  expect(mockEnsure.mock.calls.map(call => call[0])).toEqual(['IN', 'OUT']);
  expect(mockPersisted!.punches.map(punch => punch.status)).toEqual(['OUT', 'IN', 'OUT']);
  expect(error()).toBeUndefined();
});

it('ignores out-of-order refreshes and their history invalidation', async () => {
  await mount();
  const stale = mockPersisted;
  await press('toggle');
  const oldRead = deferred<TrackerSnapshot | null>();
  mockRead.mockReturnValueOnce(oldRead.promise);
  await act(async () => mockForeground('active'));
  await act(async () => mockExternal());
  await act(async () => oldRead.resolve(stale));
  expect(text()).toContain('TRAYS ARE IN');
  expect(button('Undo').props.modifiers).toContainEqual({ disabled: false });
});

it.each(['toggle', 'Undo', 'Redo'])('coalesces refresh events during %s and reads back the commit', async kind => {
  await mount();
  if (kind !== 'toggle') await press('toggle');
  if (kind === 'Redo') await press('Undo');
  const operation = kind === 'toggle' ? mockEnsure : kind === 'Undo' ? mockUndo : mockRedo;
  const implementation = operation.getMockImplementation()!;
  const gate = deferred<void>();
  operation.mockImplementationOnce(async (...args: unknown[]) => {
    await gate.promise;
    return implementation(...args);
  });
  await press(kind);
  const readCount = mockRead.mock.calls.length;
  await act(async () => { mockExternal(); mockForeground('active'); mockExternal(); });
  expect(mockRead).toHaveBeenCalledTimes(readCount);
  await act(async () => gate.resolve());
  expect(mockRead).toHaveBeenCalledTimes(readCount + 1);
  expect(text()).toContain(kind === 'Undo' ? 'TRAYS ARE OUT' : 'TRAYS ARE IN');
  expect(error()).toBeUndefined();
});

it('discards a read after blur and reloads on focus', async () => {
  await mount();
  const late = deferred<TrackerSnapshot | null>();
  mockRead.mockReturnValueOnce(late.promise);
  await act(async () => mockExternal());
  await act(async () => mockBlur());
  await act(async () => late.resolve(null));
  expect(text()).toContain('TRAYS ARE OUT');
  await act(async () => { mockBlur = mockFocus(); });
  expect(text()).toContain('TRAYS ARE OUT');
});

it('handles already-in-state without another punch or a fabricated undo action', async () => {
  await mount();
  mockPersisted = { ...mockPersisted!, punches: [...mockPersisted!.punches, { id: 2, status: 'IN', timestamp: Date.now() }] };
  mockEnsure.mockResolvedValueOnce({ outcome: 'already-in-state', status: 'IN', notificationStatus: 'not-needed' });
  await press('toggle');
  expect(text()).toContain('TRAYS ARE IN');
  expect(mockPersisted!.punches).toHaveLength(2);
  expect(button('Undo').props.modifiers).toContainEqual({ disabled: true });
  expect(error()).toBeUndefined();
});

it('shows missing treatment separately', async () => {
  await mount();
  mockEnsure.mockImplementationOnce(async () => {
    mockPersisted = null;
    return { outcome: 'no-active-treatment', notificationStatus: 'not-needed' };
  });
  await press('toggle');
  expect(tree.root.findAllByType('CenteredState')[0].props.message).toContain('No active treatment');
});

it('keeps saved state and a reminder warning when reminder reconciliation fails', async () => {
  await mount();
  const implementation = mockEnsure.getMockImplementation()!;
  mockEnsure.mockImplementationOnce(async (...args: unknown[]) => ({ ...await implementation(...args), notificationStatus: 'failed' }));
  await press('toggle');
  expect(text()).toContain('TRAYS ARE IN');
  expect(error()).toBe('Tracker saved, but reminders could not be refreshed.');
});

it('reports a failed save and reloads persisted state', async () => {
  await mount();
  mockEnsure.mockRejectedValueOnce(new Error('write failed'));
  await press('toggle');
  expect(text()).toContain('TRAYS ARE OUT');
  expect(error()).toBe('The tracker could not be updated.');
});

it.each([true, false])('offers Retry when readback fails (save succeeded: %s)', async saved => {
  await mount();
  if (!saved) mockEnsure.mockRejectedValueOnce(new Error('write failed'));
  mockRead.mockRejectedValueOnce(new Error('read failed'));
  await press('toggle');
  expect(error()).toContain('displayed state may be outdated');
  expect(error()).toContain(saved ? 'Tracker saved' : 'could not be updated');
  expect(button('toggle').props.modifiers).toContainEqual({ disabled: true });
  await press('Retry');
  expect(button('toggle').props.modifiers).toContainEqual({ disabled: false });
  expect(error() ?? '').not.toContain('outdated');
});
