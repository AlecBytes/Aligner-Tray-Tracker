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
      const reminders = buildReminderRequests(
        trackerSnapshot(snapshot),
        snapshot.settings,
        fixture.nowMs,
        utcReminderCalendar,
      );
      const kindCounts = reminders.reduce<Record<ReminderKind, number>>(
        (counts, current) => ({ ...counts, [current.kind]: counts[current.kind] + 1 }),
        { 'out-too-long': 0, 'tray-change': 0 },
      );

      expect(reminders).toHaveLength(fixture.expected.totalCount);
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
