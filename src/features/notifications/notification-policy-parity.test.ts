import type { Settings, WearStatus } from '@/db/schema';
import {
  buildReminderRequests,
  planReminderReconciliation,
  type ReminderCalendar,
  type ReminderKind,
  type ReminderRequest,
} from '@/features/notifications/notification-policy';
import type { TrackerSnapshot } from '@/features/tracker/tracker-model';

import parityFixtures from '../../../modules/aligner-tracker-intents/ios/Tests/Fixtures/notification-policy.json';

// A separate Node process exercises real local Date behavior in each zone;
// changing TZ inside Jest's environment does not reliably change its timezone.
const { execFileSync } = jest.requireActual('node:child_process') as {
  execFileSync: (file: string, args: string[], options: {
    env: Record<string, string | undefined>; input: string; encoding: 'utf8'; timeout: number;
  }) => string;
};
const { readFileSync } = jest.requireActual('node:fs') as { readFileSync: (path: string, encoding: 'utf8') => string };
const ts = jest.requireActual('typescript') as typeof import('typescript');
const policyCode = ts.transpileModule(
  readFileSync('src/features/notifications/notification-policy.ts', 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;

function buildInTimeZone(snapshot: TrackerSnapshot, settings: Settings, now: number, timeZone: string): ReminderRequest[] {
  const script = `
    const input = JSON.parse(require('node:fs').readFileSync(0, 'utf8'));
    const policy = {};
    new Function('exports', input.code)(policy);
    process.stdout.write(JSON.stringify(policy.buildReminderRequests(input.snapshot, input.settings, input.now)));
  `;
  return JSON.parse(execFileSync(process.execPath, ['-e', script], {
    env: { ...process.env, TZ: timeZone },
    input: JSON.stringify({ code: policyCode, snapshot, settings, now }),
    encoding: 'utf8',
    timeout: 5000,
  }));
}

type FixtureReminder = {
  body: string;
  fingerprint: string;
  kind: ReminderKind;
  scheduledAtMs: number;
};

type FixtureSnapshot = {
  currentTrayNumber: number;
  daysPerTray: number;
  latestPunch: {
    id: number;
    status: WearStatus;
    timestamp: number;
  };
  settings: Settings;
  totalTrays: number;
  trayPeriodId: number;
  trayStartedAt: number;
};

const utcReminderCalendar: ReminderCalendar = {
  daysBetween(from, to) {
    return Math.floor(to / 86400000) - Math.floor(from / 86400000);
  },
  addDays(timestamp, days) {
    const date = new Date(timestamp);
    date.setUTCDate(date.getUTCDate() + days);
    return date.getTime();
  },
  setTime(timestamp, hour, minute) {
    const date = new Date(timestamp);
    date.setUTCHours(hour, minute, 0, 0);
    return date.getTime();
  },
};

function trackerSnapshot(fixture: FixtureSnapshot): TrackerSnapshot {
  return {
    currentTrayNumber: fixture.currentTrayNumber,
    daysPerTray: fixture.daysPerTray,
    punches: [fixture.latestPunch],
    totalTrays: fixture.totalTrays,
    trayPeriodId: fixture.trayPeriodId,
    trayStartedAt: fixture.trayStartedAt,
  };
}

function reminder(fixture: FixtureReminder): ReminderRequest {
  return {
    body: fixture.body,
    fingerprint: fixture.fingerprint,
    kind: fixture.kind,
    scheduledAt: fixture.scheduledAtMs,
    sound: 'default',
  };
}

describe('notification policy parity fixtures', () => {
  it('declares UTC as its execution time zone', () => {
    expect(parityFixtures.timeZone).toBe('UTC');
  });

  for (const fixture of parityFixtures.buildCases) {
    it(fixture.name, () => {
      const snapshot = fixture.snapshot as FixtureSnapshot;
      const reminders = 'timeZone' in fixture ? buildInTimeZone(
        trackerSnapshot(snapshot), snapshot.settings, fixture.nowMs, fixture.timeZone!,
      ) : buildReminderRequests(
        trackerSnapshot(snapshot),
        snapshot.settings,
        fixture.nowMs,
        utcReminderCalendar,
      );
      const kindCounts = reminders.reduce<Record<ReminderKind, number>>(
        (counts, current) => ({ ...counts, [current.kind]: counts[current.kind] + 1 }),
        { 'out-too-long': 0, 'tray-change': 0, 'tray-change-overdue': 0 },
      );

      expect(reminders).toHaveLength(fixture.expected.totalCount);
      expect(reminders.every((request) => request.scheduledAt > fixture.nowMs)).toBe(true);
      expect(new Set(reminders.map((request) => request.fingerprint)).size).toBe(reminders.length);
      expect(kindCounts).toEqual(fixture.expected.kindCounts);
      for (const sample of fixture.expected.samples) {
        expect(reminders[sample.index]).toEqual({
          body: sample.body,
          fingerprint: sample.fingerprint,
          kind: sample.kind,
          scheduledAt: sample.scheduledAtMs,
          sound: 'default',
        });
      }
    });
  }

  it('replaces pending overdue content after a timezone change', () => {
    const fixture = parityFixtures.buildCases.find((item) => item.name === 'late-enable-before-todays-time')!;
    const snapshot = fixture.snapshot as FixtureSnapshot;
    const before = buildInTimeZone(trackerSnapshot(snapshot), snapshot.settings, fixture.nowMs, 'UTC');
    const after = buildInTimeZone(trackerSnapshot(snapshot), snapshot.settings, fixture.nowMs, 'America/Los_Angeles');
    const result = planReminderReconciliation(after, before.map((item) => ({
      ...item, identifier: item.fingerprint,
    })));
    expect(result.cancelIdentifiers).toHaveLength(14);
    expect(result.schedule).toEqual(after);
  });

  for (const fixture of parityFixtures.reconciliationCases) {
    it(fixture.name, () => {
      const reconciliation = planReminderReconciliation(
        fixture.desired.map((current) => reminder(current as FixtureReminder)),
        fixture.scheduled,
      );

      expect(reconciliation.cancelIdentifiers).toEqual(fixture.expected.cancelIdentifiers);
      expect(reconciliation.schedule.map((current) => current.fingerprint)).toEqual(
        fixture.expected.scheduleFingerprints,
      );
    });
  }
});
