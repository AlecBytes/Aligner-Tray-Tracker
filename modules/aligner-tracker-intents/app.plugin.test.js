const mockWithBuildSourceFile = jest.fn((config) => config);

jest.mock('expo/config-plugins', () => ({
  IOSConfig: {
    XcodeProjectFile: {
      withBuildSourceFile: mockWithBuildSourceFile,
    },
  },
}));

const withAlignerTrackerIntents = require('./app.plugin');

describe('Aligner Tracker App Intents config plugin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('writes deterministic thin App Intent declarations into the main app target', () => {
    const config = { name: 'Aligner Tracker' };

    expect(withAlignerTrackerIntents(config)).toBe(config);
    expect(withAlignerTrackerIntents(config)).toBe(config);
    expect(mockWithBuildSourceFile).toHaveBeenCalledTimes(2);

    const firstOptions = mockWithBuildSourceFile.mock.calls[0][1];
    const secondOptions = mockWithBuildSourceFile.mock.calls[1][1];
    expect(firstOptions).toEqual(secondOptions);
    expect(firstOptions).toEqual(
      expect.objectContaining({
        filePath: 'AlignerTrackerAppIntents.swift',
        overwrite: true,
      }),
    );

    const source = firstOptions.contents;
    expect(source).toContain('import AppIntents');
    expect(source).toContain('@available(iOS 16.4, *)');
    expect(source).toContain('struct MarkTraysOutIntent: AppIntent');
    expect(source).toContain('struct MarkTraysInIntent: AppIntent');
    expect(source).toContain('struct AlignerTrackerAppShortcuts: AppShortcutsProvider');
    expect(source.match(/IntentAuthenticationPolicy = \.alwaysAllowed/g)).toHaveLength(2);
    expect(source.match(/openAppWhenRun = false/g)).toHaveLength(2);
    expect(source).toContain('Mark my trays out in \\(.applicationName)');
    expect(source).toContain('Trays out in \\(.applicationName)');
    expect(source).toContain('Mark my trays in with \\(.applicationName)');
    expect(source).toContain('Trays in with \\(.applicationName)');
    expect(source).toContain('case .appOpenRequired:');
    expect(source).toContain('Open Aligner Tracker once, then try again.');
    expect(source).toContain('case .noActiveTreatment:');
    expect(source).toContain('case .changed:');
    expect(source).toContain('case .alreadyInState:');
    expect(source).toContain('AlignerTrackerAppShortcuts.updateAppShortcutParameters()');

    expect(source).not.toContain('sqlite3_');
    expect(source).not.toContain('BEGIN IMMEDIATE');
    expect(source).not.toContain('UNUserNotificationCenter');
  });
});
