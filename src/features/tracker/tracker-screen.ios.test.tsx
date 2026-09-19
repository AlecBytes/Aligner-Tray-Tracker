import React from 'react';
import { clearTrackerSessionHistory } from './tracker-history-session';
import type { TrackerSnapshot } from './tracker-model';
import { TrackerScreen } from './tracker-screen.ios';

let mockFocusCallbacks: (() => () => void)[] = [];
let mockFocusCleanups: (() => void)[] = [];
let mockAppStateListeners: ((state: string) => void)[] = [];
let mockExternal: () => void;
let mockPersisted: TrackerSnapshot | null;
const mockRead = jest.fn(async () => mockPersisted);
const mockEnsure = jest.fn();
const mockReconcileNative = jest.fn();
const mockUndo = jest.fn();
const mockRedo = jest.fn();
const mockPush = jest.fn();
const mockSetAudioMode = jest.fn();
const mockImpact = jest.fn();
const mockNotification = jest.fn();
const mockInPlayer = {
  isLoaded: true,
  pause: jest.fn(),
  play: jest.fn(),
  seekTo: jest.fn(async () => undefined),
  volume: 1,
};
const mockOutPlayer = {
  isLoaded: true,
  pause: jest.fn(),
  play: jest.fn(),
  seekTo: jest.fn(async () => undefined),
  volume: 1,
};
let mockAudioPlayerCall = 0;

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (callback: () => () => void) => {
    const react = jest.requireActual('react') as typeof React;
    react.useEffect(() => {
      mockFocusCallbacks.push(callback);
      const cleanup = callback();
      mockFocusCleanups.push(cleanup);
      return cleanup;
    }, [callback]);
  },
}));
jest.mock('expo-sqlite', () => {
  const db = {};
  return { useSQLiteContext: () => db };
});
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  Object.defineProperty(native.AppState, 'currentState', {
    configurable: true,
    value: 'active',
  });
  native.AppState.addEventListener = (_: string, listener: (state: string) => void) => {
    mockAppStateListeners.push(listener);
    return {
      remove: () => {
        mockAppStateListeners = mockAppStateListeners.filter(item => item !== listener);
      },
    };
  };
  return native;
});
jest.mock('expo-audio', () => {
  const preloadedSources: unknown[] = [];
  return {
    preloadedSources,
    preload: (source: unknown) => {
      preloadedSources.push(source);
      return Promise.resolve();
    },
    setAudioModeAsync: (...args: unknown[]) => mockSetAudioMode(...args),
    useAudioPlayer: jest.fn((..._args: unknown[]) =>
      [mockInPlayer, mockOutPlayer][mockAudioPlayerCall++ % 2]),
  };
});
jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Rigid: 'rigid' },
  NotificationFeedbackType: { Error: 'error' },
  impactAsync: (...args: unknown[]) => mockImpact(...args),
  notificationAsync: (...args: unknown[]) => mockNotification(...args),
}));
jest.mock('@expo/ui/swift-ui', () => ({
  Button: 'Button', Host: 'Host', HStack: 'HStack', Image: 'Image', Spacer: 'Spacer', Text: 'Text', VStack: 'VStack',
}));
jest.mock('@expo/ui/swift-ui/modifiers', () => ({
  ...Object.fromEntries([
    'accessibilityHidden', 'accessibilityHint', 'accessibilityLabel', 'accessibilityValue', 'aspectRatio', 'background', 'buttonBorderShape', 'buttonStyle',
    'contentTransition', 'controlSize', 'disabled', 'font', 'foregroundStyle', 'frame', 'lineLimit',
    'minimumScaleFactor', 'monospacedDigit', 'opacity', 'padding', 'resizable',
  ].map(name => [name, (value: unknown) => ({ [name]: value })])),
  shapes: { roundedRectangle: () => ({}) },
}));
jest.mock('expo-asset', () => ({
  useAssets: () => [
    [
      { localUri: 'file:///tray-in.png' },
      { localUri: 'file:///tray-out.png' },
      { localUri: 'file:///trays.png' },
    ],
    undefined,
  ],
}));
jest.mock('@/components/app-loading-screen', () => ({ AppLoadingScreen: 'AppLoadingScreen' }));
jest.mock('@/components/expo-ui-components', () => ({
  ActionButton: 'ActionButton', CenteredState: 'CenteredState', ValidationMessage: 'ValidationMessage',
  isLiquidGlassPlatform: () => true,
}));
jest.mock('@/theme/use-app-theme', () => ({
  useAppTheme: () => ({
    border: 'gray',
    onPrimary: 'white',
    primary: 'purple',
    primaryPressed: 'dark-purple',
    surface: 'white',
    text: 'black',
  }),
}));
jest.mock('../../../modules/tracker-status-control', () => ({
  trackerStatusControlStyle: (value: unknown) => ({ trackerStatusControlStyle: value }),
}));
jest.mock('@/features/notifications/local-notifications', () => ({ reconcileLocalNotifications: jest.fn() }));
jest.mock('@/features/siri/aligner-tracker-intents', () => ({
  isNativeWearStatusAvailable: () => true,
  commitWearStatus: (...args: unknown[]) => mockEnsure(...args),
  reconcileNativeNotifications: (...args: unknown[]) => mockReconcileNative(...args),
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

type TestNode = { props: { label?: string; onPress?: () => void; onPressIn?: (event: unknown) => void; onPressOut?: (event: unknown) => void; message?: string; children?: unknown; modifiers?: Record<string, unknown>[]; uiImage?: string; source?: { uri: string }; style?: { opacity?: number }; disabled?: boolean; accessibilityValue?: { text: string }; testID?: string; onLayout?: (event: unknown) => void } };
const renderer = jest.requireActual('react-test-renderer') as {
  act: (callback: () => void | Promise<void>) => Promise<void>;
  create: (element: React.ReactElement) => {
    root: { findAll: (predicate: (node: TestNode) => boolean) => TestNode[]; findAllByType: (type: unknown) => TestNode[] };
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
function rawTextInSwiftUIContainers() {
  return ['Host', 'HStack', 'VStack', 'Button'].flatMap(type =>
    tree.root.findAllByType(type).flatMap(node =>
      React.Children.toArray(node.props.children as React.ReactNode).filter(
        child => typeof child === 'string',
      ),
    ),
  );
}
function button(label: string) {
  if (label === 'toggle') {
    return tree.root.findAll(node => node.props.testID === 'tracker-toggle-button' && typeof node.props.onPress === 'function')[0]!;
  }
  return tree.root.findAllByType('Button').find(node => node.props.label === label)!;
}
function accessibleButton(label: string) {
  return tree.root.findAllByType('Button').find(node =>
    node.props.modifiers?.some(modifier => modifier.accessibilityLabel === label),
  )!;
}
const press = (label: string) => act(async () => { button(label).props.onPress!(); });
const emitAppState = (state: string) => {
  for (const listener of [...mockAppStateListeners]) listener(state);
};
const blurScreen = () => {
  const cleanups = [...mockFocusCleanups];
  mockFocusCleanups = [];
  for (const cleanup of cleanups) cleanup();
};
const focusScreen = () => {
  mockFocusCleanups = mockFocusCallbacks.map(callback => callback());
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFocusCallbacks = [];
  mockFocusCleanups = [];
  mockAppStateListeners = [];
  mockAudioPlayerCall = 0;
  mockInPlayer.isLoaded = true;
  mockInPlayer.volume = 1;
  mockOutPlayer.isLoaded = true;
  mockOutPlayer.volume = 1;
  mockSetAudioMode.mockResolvedValue(undefined);
  mockImpact.mockResolvedValue(undefined);
  mockNotification.mockResolvedValue(undefined);
  mockRead.mockReset().mockImplementation(async () => mockPersisted);
  mockEnsure.mockReset().mockImplementation(async (status: 'IN' | 'OUT', timestamp: number) => {
    const predecessor = mockPersisted!.punches[mockPersisted!.punches.length - 1];
    const punch = { id: mockPersisted!.punches.length + 1, status, timestamp };
    mockPersisted = { ...mockPersisted!, punches: [...mockPersisted!.punches, punch] };
    return { outcome: 'changed', predecessor, punch, trayPeriodId: mockPersisted!.trayPeriodId };
  });
  mockReconcileNative.mockReset().mockResolvedValue(true);
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
afterEach(async () => {
  blurScreen();
  if (tree) await act(async () => tree.unmount());
});
async function mount() { await act(async () => { tree = renderer.create(<TrackerScreen />); }); }

it('skips unavailable initial audio setup and retries until it succeeds', async () => {
  mockSetAudioMode
    .mockImplementationOnce(() => {
      throw new Error('audio mode unavailable');
    })
    .mockRejectedValueOnce(new Error('audio mode unavailable'));
  await mount();
  await press('toggle');
  expect(mockImpact).toHaveBeenCalledTimes(1);
  expect(mockInPlayer.play).not.toHaveBeenCalled();

  await act(async () => tree.unmount());
  tree = null as unknown as typeof tree;
  await mount();
  await press('toggle');
  expect(mockOutPlayer.play).not.toHaveBeenCalled();

  await act(async () => tree.unmount());
  tree = null as unknown as typeof tree;
  await mount();
  await press('toggle');

  expect(mockSetAudioMode).toHaveBeenCalledTimes(3);
  expect(mockInPlayer.play).toHaveBeenCalledTimes(1);
});

it('shows the decorative tray image for the current tracker state', async () => {
  await mount();
  expect(rawTextInSwiftUIContainers()).toEqual([]);
  const trayImage = () => tree.root.findAllByType('Image').find(node => node.props.uiImage?.startsWith('file:///tray-'))!;
  const duration = () => tree.root.findAllByType('Text').find(node =>
    node.props.modifiers?.some(modifier => 'opacity' in modifier),
  )!;
  expect(trayImage().props.uiImage).toBe('file:///tray-out.png');
  expect(duration().props.modifiers).toContainEqual({ opacity: 1 });
  await press('toggle');
  expect(trayImage().props.uiImage).toBe('file:///tray-in.png');
  expect(duration().props.modifiers).toContainEqual({ opacity: 0 });
});

it('describes the current action and state to assistive technology', async () => {
  await mount();
  const toggle = () => button('toggle');

  expect(toggle().props.modifiers).toEqual(expect.arrayContaining([
    { accessibilityLabel: 'Trays' },
    { accessibilityValue: 'OUT' },
    { accessibilityHint: 'Tap when trays are inserted.' },
  ]));

  await press('toggle');

  expect(toggle().props.modifiers).toEqual(expect.arrayContaining([
    { accessibilityLabel: 'Trays' },
    { accessibilityValue: 'IN' },
    { accessibilityHint: 'Tap when trays are removed.' },
  ]));
});

it('keeps confirmed state while committing, then renders the commit before notifications finish', async () => {
  await mount();
  const commit = deferred<{
    nativeCommitDurationMs: number;
    outcome: 'changed';
    predecessor: TrackerSnapshot['punches'][number];
    punch: TrackerSnapshot['punches'][number];
    trayPeriodId: number;
  }>();
  const notifications = deferred<boolean>();
  const predecessor = mockPersisted!.punches[0];
  const punch = { id: 2, status: 'IN' as const, timestamp: Date.now() };
  mockEnsure.mockReturnValueOnce(commit.promise);
  mockReconcileNative.mockReturnValueOnce(notifications.promise);

  act(() => button('toggle').props.onPress!());
  expect(text()).toContain('TRAYS ARE OUT');
  expect(text()).toContain('Saving…');
  expect(button('toggle').props.modifiers).toContainEqual({ accessibilityValue: 'OUT, saving' });
  expect(button('toggle').props.modifiers).toContainEqual({ accessibilityHint: 'Saving the tracker change.' });
  expect(button('toggle').props.modifiers).toContainEqual({ disabled: true });
  expect(mockImpact).not.toHaveBeenCalled();
  expect(mockNotification).not.toHaveBeenCalled();
  expect(mockInPlayer.play).not.toHaveBeenCalled();
  expect(mockOutPlayer.play).not.toHaveBeenCalled();

  mockPersisted = { ...mockPersisted!, punches: [predecessor, punch] };
  await act(async () => commit.resolve({
    nativeCommitDurationMs: 2,
    outcome: 'changed',
    predecessor,
    punch,
    trayPeriodId: 1,
  }));
  expect(text()).toContain('TRAYS ARE IN');
  expect(text()).not.toContain('Saving…');
  expect(button('toggle').props.modifiers).toContainEqual({ accessibilityHint: 'Tap when trays are removed.' });
  expect(button('toggle').props.modifiers).toContainEqual({ disabled: false });
  expect(mockImpact).toHaveBeenCalledTimes(1);
  expect(mockInPlayer.play).toHaveBeenCalledTimes(1);
  expect(error()).toBeUndefined();

  await act(async () => notifications.resolve(true));
  expect(error()).toBeUndefined();
});

it('ignores duplicate toggles while the first commit is pending', async () => {
  await mount();
  const commit = deferred<never>();
  mockEnsure.mockReturnValueOnce(commit.promise);
  act(() => {
    button('toggle').props.onPress!();
    button('toggle').props.onPress!();
  });
  expect(mockEnsure).toHaveBeenCalledTimes(1);
  expect(mockImpact).not.toHaveBeenCalled();
  expect(mockInPlayer.play).not.toHaveBeenCalled();
  expect(mockOutPlayer.play).not.toHaveBeenCalled();
  await act(async () => commit.reject(new Error('write failed')));
  expect(mockNotification).toHaveBeenCalledTimes(1);
});

it('persists the timestamp captured for the accepted toggle', async () => {
  await mount();
  await press('toggle');
  const acceptedTimestamp = mockEnsure.mock.calls[0][1];
  expect(typeof acceptedTimestamp).toBe('number');
  expect(mockPersisted!.punches.at(-1)?.timestamp).toBe(acceptedTimestamp);
});

it('opens the treatment plan from the bundled trays shortcut', async () => {
  await mount();
  const image = tree.root.findAllByType('Image').find(
    node => node.props.uiImage === 'file:///trays.png',
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
  await act(async () => blurScreen());
  await act(async () => focusScreen());
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
  await act(async () => emitAppState('active'));
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
  await act(async () => { mockExternal(); emitAppState('active'); mockExternal(); });
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
  await act(async () => blurScreen());
  await act(async () => late.resolve(null));
  expect(text()).toContain('TRAYS ARE OUT');
  await act(async () => focusScreen());
  expect(text()).toContain('TRAYS ARE OUT');
});

it('handles already-in-state without another punch or a fabricated undo action', async () => {
  await mount();
  mockPersisted = { ...mockPersisted!, punches: [...mockPersisted!.punches, { id: 2, status: 'IN', timestamp: Date.now() }] };
  mockEnsure.mockResolvedValueOnce({ outcome: 'already-in-state', status: 'IN' });
  await press('toggle');
  expect(text()).toContain('TRAYS ARE IN');
  expect(mockPersisted!.punches).toHaveLength(2);
  expect(button('Undo').props.modifiers).toContainEqual({ disabled: true });
  expect(error()).toBeUndefined();
});

it('builds Undo from the predecessor returned by the committed native mutation', async () => {
  await mount();
  const displayedPredecessor = mockPersisted!.punches[0];
  const authoritativePredecessor = {
    id: 2,
    status: 'OUT' as const,
    timestamp: displayedPredecessor.timestamp + 1,
  };
  const punch = { id: 3, status: 'IN' as const, timestamp: Date.now() };
  mockPersisted = {
    ...mockPersisted!,
    punches: [displayedPredecessor, authoritativePredecessor, punch],
  };
  mockEnsure.mockResolvedValueOnce({
    nativeCommitDurationMs: 1,
    outcome: 'changed',
    predecessor: authoritativePredecessor,
    punch,
    trayPeriodId: 1,
  });

  await press('toggle');
  await press('Undo');
  expect(mockUndo.mock.calls[0][1]).toMatchObject({
    predecessor: authoritativePredecessor,
    punch,
    trayPeriodId: 1,
  });
});

it('shows missing treatment separately', async () => {
  await mount();
  mockEnsure.mockImplementationOnce(async () => {
    mockPersisted = null;
    return { outcome: 'no-active-treatment' };
  });
  await press('toggle');
  expect(tree.root.findAllByType('CenteredState')[0].props.message).toContain('No active treatment');
});

it('keeps saved state and a reminder warning when reminder reconciliation fails', async () => {
  await mount();
  mockReconcileNative.mockResolvedValueOnce(false);
  await press('toggle');
  expect(text()).toContain('TRAYS ARE IN');
  expect(error()).toBe('Tracker saved, but reminders could not be refreshed.');
});

it('keeps saved state when the notification bridge rejects', async () => {
  await mount();
  mockReconcileNative.mockRejectedValueOnce(new Error('notification bridge failed'));
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

it('emits one matching success haptic and sound for each confirmed transition', async () => {
  await mount();

  await press('toggle');
  expect(mockImpact).toHaveBeenCalledWith('rigid');
  expect(mockImpact).toHaveBeenCalledTimes(1);
  expect(mockInPlayer.play).toHaveBeenCalledTimes(1);
  expect(mockOutPlayer.play).not.toHaveBeenCalled();

  await press('toggle');
  expect(mockImpact).toHaveBeenCalledTimes(2);
  expect(mockOutPlayer.play).toHaveBeenCalledTimes(1);
  expect(mockInPlayer.play).toHaveBeenCalledTimes(1);
  expect(mockInPlayer.pause).toHaveBeenCalled();
  expect(mockOutPlayer.pause).toHaveBeenCalled();
  expect(mockInPlayer.seekTo).toHaveBeenCalledWith(0);
  expect(mockOutPlayer.seekTo).toHaveBeenCalledWith(0);
});

it('preloads both effects and keeps their iOS audio sessions active', async () => {
  await mount();
  const audio = jest.requireMock('expo-audio') as {
    preloadedSources: unknown[];
    useAudioPlayer: jest.Mock;
  };

  expect(audio.preloadedSources).toHaveLength(2);
  expect(audio.useAudioPlayer).toHaveBeenNthCalledWith(
    1,
    expect.any(Number),
    { keepAudioSessionActive: true },
  );
  expect(audio.useAudioPlayer).toHaveBeenNthCalledWith(
    2,
    expect.any(Number),
    { keepAudioSessionActive: true },
  );
});

it('waits for rewind before playing a confirmation sound', async () => {
  const rewind = deferred<undefined>();
  mockInPlayer.seekTo.mockReturnValueOnce(rewind.promise);
  await mount();

  await press('toggle');
  expect(mockInPlayer.seekTo).toHaveBeenCalledWith(0);
  expect(mockInPlayer.play).not.toHaveBeenCalled();

  await act(async () => rewind.resolve(undefined));
  expect(mockInPlayer.play).toHaveBeenCalledTimes(1);
});

it('does not play when rewind rejects', async () => {
  mockInPlayer.seekTo.mockRejectedValueOnce(new Error('rewind unavailable'));
  await mount();

  await press('toggle');

  expect(mockImpact).toHaveBeenCalledTimes(1);
  expect(mockInPlayer.play).not.toHaveBeenCalled();
  expect(text()).toContain('TRAYS ARE IN');
});

it('cancels a pending replay when the screen blurs', async () => {
  const rewind = deferred<undefined>();
  mockInPlayer.seekTo.mockReturnValueOnce(rewind.promise);
  await mount();

  await press('toggle');
  await act(async () => blurScreen());
  await act(async () => rewind.resolve(undefined));

  expect(mockInPlayer.play).not.toHaveBeenCalled();
});

it('cancels a pending replay when the app backgrounds', async () => {
  const rewind = deferred<undefined>();
  mockInPlayer.seekTo.mockReturnValueOnce(rewind.promise);
  await mount();

  await press('toggle');
  await act(async () => emitAppState('background'));
  await act(async () => rewind.resolve(undefined));

  expect(mockInPlayer.play).not.toHaveBeenCalled();
});

it('cancels a pending replay when the screen unmounts', async () => {
  const rewind = deferred<undefined>();
  mockInPlayer.seekTo.mockReturnValueOnce(rewind.promise);
  await mount();

  await press('toggle');
  await act(async () => tree.unmount());
  tree = null as unknown as typeof tree;
  await act(async () => rewind.resolve(undefined));

  expect(mockInPlayer.play).not.toHaveBeenCalled();
});

it('lets a newer confirmation supersede a pending replay', async () => {
  const firstRewind = deferred<undefined>();
  mockInPlayer.seekTo.mockReturnValueOnce(firstRewind.promise);
  await mount();

  await press('toggle');
  await press('toggle');
  expect(mockOutPlayer.play).toHaveBeenCalledTimes(1);

  await act(async () => firstRewind.resolve(undefined));
  expect(mockInPlayer.play).not.toHaveBeenCalled();
});

it('lets a newer failed activation supersede a pending replay', async () => {
  const firstRewind = deferred<undefined>();
  mockInPlayer.seekTo.mockReturnValueOnce(firstRewind.promise);
  await mount();

  await press('toggle');
  mockEnsure.mockRejectedValueOnce(new Error('write failed'));
  await press('toggle');
  await act(async () => firstRewind.resolve(undefined));

  expect(mockNotification).toHaveBeenCalledWith('error');
  expect(mockInPlayer.play).not.toHaveBeenCalled();
});

it('emits error feedback without success audio when persistence rejects', async () => {
  await mount();
  mockEnsure.mockRejectedValueOnce(new Error('write failed'));

  await press('toggle');

  expect(mockNotification).toHaveBeenCalledWith('error');
  expect(mockImpact).not.toHaveBeenCalled();
  expect(mockInPlayer.play).not.toHaveBeenCalled();
  expect(mockOutPlayer.play).not.toHaveBeenCalled();
});

it.each(['already-in-state', 'no-active-treatment'] as const)(
  'does not emit feedback for %s',
  async outcome => {
    await mount();
    mockEnsure.mockResolvedValueOnce(
      outcome === 'already-in-state'
        ? { outcome, status: 'IN' }
        : { outcome },
    );

    await press('toggle');

    expect(mockImpact).not.toHaveBeenCalled();
    expect(mockNotification).not.toHaveBeenCalled();
    expect(mockInPlayer.play).not.toHaveBeenCalled();
    expect(mockOutPlayer.play).not.toHaveBeenCalled();
  },
);

it('does not repeat or reclassify feedback when post-commit work fails', async () => {
  await mount();
  mockReconcileNative.mockRejectedValueOnce(new Error('notification bridge failed'));
  mockRead.mockRejectedValueOnce(new Error('readback failed'));

  await press('toggle');

  expect(mockImpact).toHaveBeenCalledTimes(1);
  expect(mockInPlayer.play).toHaveBeenCalledTimes(1);
  expect(mockNotification).not.toHaveBeenCalled();
});

it('keeps confirmation successful when reminder reconciliation throws synchronously', async () => {
  await mount();
  mockReconcileNative.mockImplementationOnce(() => {
    throw new Error('notification bridge unavailable');
  });

  await press('toggle');

  expect(text()).toContain('TRAYS ARE IN');
  expect(error()).toBe('Tracker saved, but reminders could not be refreshed.');
  expect(mockImpact).toHaveBeenCalledTimes(1);
  expect(mockInPlayer.play).toHaveBeenCalledTimes(1);
  expect(mockNotification).not.toHaveBeenCalled();
});

it('suppresses a stale confirmation after leaving and returning before commit', async () => {
  await mount();
  const commit = deferred<{
    outcome: 'changed';
    predecessor: TrackerSnapshot['punches'][number];
    punch: TrackerSnapshot['punches'][number];
    trayPeriodId: number;
  }>();
  const predecessor = mockPersisted!.punches[0];
  const punch = { id: 2, status: 'IN' as const, timestamp: Date.now() };
  mockEnsure.mockReturnValueOnce(commit.promise);

  act(() => button('toggle').props.onPress!());
  await act(async () => blurScreen());
  await act(async () => focusScreen());
  mockPersisted = { ...mockPersisted!, punches: [predecessor, punch] };
  await act(async () => commit.resolve({ outcome: 'changed', predecessor, punch, trayPeriodId: 1 }));

  expect(mockImpact).not.toHaveBeenCalled();
  expect(mockNotification).not.toHaveBeenCalled();
  expect(mockInPlayer.play).not.toHaveBeenCalled();
});

it('suppresses a stale confirmation after the app backgrounds before commit', async () => {
  await mount();
  const commit = deferred<{
    outcome: 'changed';
    predecessor: TrackerSnapshot['punches'][number];
    punch: TrackerSnapshot['punches'][number];
    trayPeriodId: number;
  }>();
  const predecessor = mockPersisted!.punches[0];
  const punch = { id: 2, status: 'IN' as const, timestamp: Date.now() };
  mockEnsure.mockReturnValueOnce(commit.promise);

  act(() => button('toggle').props.onPress!());
  await act(async () => emitAppState('background'));
  mockPersisted = { ...mockPersisted!, punches: [predecessor, punch] };
  await act(async () => commit.resolve({ outcome: 'changed', predecessor, punch, trayPeriodId: 1 }));

  expect(mockImpact).not.toHaveBeenCalled();
  expect(mockNotification).not.toHaveBeenCalled();
  expect(mockInPlayer.play).not.toHaveBeenCalled();
});

it('suppresses a stale confirmation after unmount', async () => {
  await mount();
  const commit = deferred<{
    outcome: 'changed';
    predecessor: TrackerSnapshot['punches'][number];
    punch: TrackerSnapshot['punches'][number];
    trayPeriodId: number;
  }>();
  const predecessor = mockPersisted!.punches[0];
  const punch = { id: 2, status: 'IN' as const, timestamp: Date.now() };
  mockEnsure.mockReturnValueOnce(commit.promise);

  act(() => button('toggle').props.onPress!());
  await act(async () => tree.unmount());
  expect(mockInPlayer.pause).toHaveBeenCalled();
  expect(mockOutPlayer.pause).toHaveBeenCalled();
  tree = null as unknown as typeof tree;
  mockPersisted = { ...mockPersisted!, punches: [predecessor, punch] };
  await act(async () => commit.resolve({ outcome: 'changed', predecessor, punch, trayPeriodId: 1 }));

  expect(mockImpact).not.toHaveBeenCalled();
  expect(mockNotification).not.toHaveBeenCalled();
  expect(mockInPlayer.play).not.toHaveBeenCalled();
});

it('keeps a saved transition successful when audio and haptics fail', async () => {
  mockImpact.mockRejectedValueOnce(new Error('haptic unavailable'));
  mockInPlayer.play.mockImplementationOnce(() => {
    throw new Error('audio unavailable');
  });
  await mount();

  await press('toggle');

  expect(text()).toContain('TRAYS ARE IN');
  expect(error()).toBeUndefined();
  expect(mockNotification).not.toHaveBeenCalled();
});

it('reuses successful audio session configuration across mounts', async () => {
  mockSetAudioMode.mockRejectedValueOnce(new Error('audio session unavailable'));
  await mount();

  await press('toggle');

  expect(mockImpact).toHaveBeenCalledTimes(1);
  expect(mockSetAudioMode).not.toHaveBeenCalled();
  expect(mockInPlayer.play).toHaveBeenCalledTimes(1);
  expect(text()).toContain('TRAYS ARE IN');
});

it('skips a sound that is not loaded at confirmation time', async () => {
  mockInPlayer.isLoaded = false;
  await mount();

  await press('toggle');

  expect(mockImpact).toHaveBeenCalledTimes(1);
  expect(mockInPlayer.play).not.toHaveBeenCalled();
  expect(text()).toContain('TRAYS ARE IN');
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
