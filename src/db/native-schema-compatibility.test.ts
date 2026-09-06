import { DATABASE_VERSION } from '@/db/migrations';

const { readFileSync } = jest.requireActual('node:fs') as {
  readFileSync(path: string, encoding: 'utf8'): string;
};

// Native code opens the same database but does not run the JS migrations.
// Catch version drift in normal validation, which runs without Xcode.
it('keeps the migrated database within the native tracker supported schema range', () => {
  const source = readFileSync(
    'modules/aligner-tracker-intents/ios/AlignerTrackerStore.swift',
    'utf8',
  );
  const minimum = source.match(/minimumSupportedDatabaseVersion = (\d+)/);
  const maximum = source.match(/maximumSupportedDatabaseVersion = (\d+)/);

  expect(minimum).not.toBeNull();
  expect(maximum).not.toBeNull();
  expect(DATABASE_VERSION).toBeGreaterThanOrEqual(Number(minimum![1]));
  expect(DATABASE_VERSION).toBeLessThanOrEqual(Number(maximum![1]));
});
