import {
  buildReminderRequests,
  OUT_REMINDER_MINUTES,
  planReminderReconciliation,
} from '@/features/notifications/notification-policy';
import type { TrackerSnapshot } from '@/features/tracker/tracker-model';

const MINUTE = 60 * 1000;

function snapshot(overrides: Partial<TrackerSnapshot> = {}): TrackerSnapshot {
  const trayStartedAt = new Date(2026, 7, 15, 9, 30).getTime();

  return {
    currentTrayNumber: 9,
    daysPerTray: 7,
    punches: [{ id: 1, status: 'IN', timestamp: trayStartedAt }],
    totalTrays: 48,
    trayPeriodId: 33,
    trayStartedAt,
    ...overrides,
  };
}

describe('buildReminderRequests', () => {
  it('schedules an OUT reminder exactly 45 minutes after the latest OUT punch', () => {
    const outAt = new Date(2026, 7, 16, 10).getTime();
    const reminders = buildReminderRequests(
      snapshot({ punches: [{ id: 2, status: 'OUT', timestamp: outAt }] }),
      outAt + MINUTE,
    );

    expect(OUT_REMINDER_MINUTES).toBe(45);
    expect(reminders).toContainEqual(
      expect.objectContaining({
        body: 'Your trays have been out for 45 minutes.',
        kind: 'out-too-long',
        scheduledAt: outAt + 45 * MINUTE,
      }),
    );
  });

  it('does not request an OUT reminder when trays are IN or the threshold passed', () => {
    const outAt = new Date(2026, 7, 16, 10).getTime();
    const inSnapshot = snapshot({
      punches: [
        { id: 1, status: 'OUT', timestamp: outAt },
        { id: 2, status: 'IN', timestamp: outAt + 10 * MINUTE },
      ],
    });
    const overdueSnapshot = snapshot({
      punches: [{ id: 1, status: 'OUT', timestamp: outAt }],
    });

    expect(
      buildReminderRequests(inSnapshot, outAt + 11 * MINUTE).some(
        (reminder) => reminder.kind === 'out-too-long',
      ),
    ).toBe(false);
    expect(
      buildReminderRequests(overdueSnapshot, outAt + 46 * MINUTE).some(
        (reminder) => reminder.kind === 'out-too-long',
      ),
    ).toBe(false);
  });

  it('schedules the tray-change reminder at the current tray start time after prescribed days', () => {
    const tracker = snapshot({ currentTrayNumber: 12, daysPerTray: 10 });
    const expectedDate = new Date(tracker.trayStartedAt);
    expectedDate.setDate(expectedDate.getDate() + 10);

    expect(buildReminderRequests(tracker, tracker.trayStartedAt)).toContainEqual(
      expect.objectContaining({
        body: 'You are scheduled to change to Tray 13 today.',
        kind: 'tray-change',
        scheduledAt: expectedDate.getTime(),
      }),
    );
  });

  it('does not schedule a nonexistent tray after the final prescribed tray', () => {
    const tracker = snapshot({ currentTrayNumber: 48, totalTrays: 48 });

    expect(
      buildReminderRequests(tracker, tracker.trayStartedAt).some(
        (reminder) => reminder.kind === 'tray-change',
      ),
    ).toBe(false);
  });
});

describe('planReminderReconciliation', () => {
  it('keeps one matching reminder and cancels duplicates', () => {
    const desired = buildReminderRequests(snapshot(), snapshot().trayStartedAt);
    const trayReminder = desired.find((reminder) => reminder.kind === 'tray-change');

    expect(trayReminder).toBeDefined();
    expect(
      planReminderReconciliation(desired, [
        {
          fingerprint: trayReminder?.fingerprint,
          identifier: 'keep-me',
          kind: 'tray-change',
        },
        {
          fingerprint: trayReminder?.fingerprint,
          identifier: 'duplicate',
          kind: 'tray-change',
        },
      ]),
    ).toEqual({ cancelIdentifiers: ['duplicate'], schedule: [] });
  });

  it('cancels stale reminders and schedules replacements after state changes', () => {
    const tracker = snapshot({
      punches: [{ id: 2, status: 'OUT', timestamp: snapshot().trayStartedAt + MINUTE }],
    });
    const desired = buildReminderRequests(tracker, tracker.trayStartedAt + 2 * MINUTE);
    const result = planReminderReconciliation(desired, [
      { fingerprint: 'old-out', identifier: 'old-out-id', kind: 'out-too-long' },
      { fingerprint: 'old-tray', identifier: 'old-tray-id', kind: 'tray-change' },
      { fingerprint: 'unrelated', identifier: 'other-app-id', kind: 'other' },
    ]);

    expect(result.cancelIdentifiers).toEqual(['old-out-id', 'old-tray-id']);
    expect(result.schedule.map((reminder) => reminder.kind)).toEqual([
      'tray-change',
      'out-too-long',
    ]);
  });

  it('cancels a pending OUT reminder when the desired state is IN', () => {
    const desired = buildReminderRequests(snapshot(), snapshot().trayStartedAt);
    const result = planReminderReconciliation(desired, [
      { fingerprint: 'pending-out', identifier: 'pending-out-id', kind: 'out-too-long' },
    ]);

    expect(result.cancelIdentifiers).toEqual(['pending-out-id']);
    expect(result.schedule.some((reminder) => reminder.kind === 'out-too-long')).toBe(false);
  });
});
