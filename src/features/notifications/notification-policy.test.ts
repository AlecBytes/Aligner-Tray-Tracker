import {
  buildReminderRequests,
  planReminderReconciliation,
} from '@/features/notifications/notification-policy';
import { DEFAULT_NOTIFICATION_SETTINGS } from '@/features/notifications/notification-settings-model';
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
  it('requests the normal notification sound for both reminder types', () => {
    const tracker = snapshot({
      punches: [{ id: 2, status: 'OUT', timestamp: snapshot().trayStartedAt }],
    });

    expect(
      buildReminderRequests(
        tracker,
        DEFAULT_NOTIFICATION_SETTINGS,
        tracker.trayStartedAt,
      ).map(({ kind, sound }) => ({ kind, sound })),
    ).toEqual([
      { kind: 'tray-change', sound: 'default' },
      { kind: 'out-too-long', sound: 'default' },
    ]);
  });

  it('schedules a custom OUT reminder from the original OUT timestamp', () => {
    const outAt = new Date(2026, 7, 16, 10).getTime();
    const reminders = buildReminderRequests(
      snapshot({ punches: [{ id: 2, status: 'OUT', timestamp: outAt }] }),
      { ...DEFAULT_NOTIFICATION_SETTINGS, outReminderMinutes: 75 },
      outAt + MINUTE,
    );

    expect(reminders).toContainEqual(
      expect.objectContaining({
        body: 'Your trays have been out for 75 minutes.',
        kind: 'out-too-long',
        scheduledAt: outAt + 75 * MINUTE,
      }),
    );
  });

  it('does not request an OUT reminder when disabled, IN, or the new target has passed', () => {
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
      buildReminderRequests(inSnapshot, DEFAULT_NOTIFICATION_SETTINGS, outAt + 11 * MINUTE).some(
        (reminder) => reminder.kind === 'out-too-long',
      ),
    ).toBe(false);
    expect(
      buildReminderRequests(
        overdueSnapshot,
        { ...DEFAULT_NOTIFICATION_SETTINGS, outReminderMinutes: 30 },
        outAt + 46 * MINUTE,
      ).some(
        (reminder) => reminder.kind === 'out-too-long',
      ),
    ).toBe(false);
    expect(
      buildReminderRequests(
        overdueSnapshot,
        { ...DEFAULT_NOTIFICATION_SETTINGS, outReminderEnabled: false },
        outAt + MINUTE,
      ).some((reminder) => reminder.kind === 'out-too-long'),
    ).toBe(false);
  });

  it('schedules the tray-change reminder at the configured time on the due date', () => {
    const tracker = snapshot({ currentTrayNumber: 12, daysPerTray: 10 });
    const expectedDate = new Date(tracker.trayStartedAt);
    expectedDate.setDate(expectedDate.getDate() + 10);
    expectedDate.setHours(18, 30, 0, 0);

    expect(
      buildReminderRequests(
        tracker,
        {
          ...DEFAULT_NOTIFICATION_SETTINGS,
          trayChangeReminderHour: 18,
          trayChangeReminderMinute: 30,
        },
        tracker.trayStartedAt,
      ),
    ).toContainEqual(
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
      buildReminderRequests(
        tracker,
        DEFAULT_NOTIFICATION_SETTINGS,
        tracker.trayStartedAt,
      ).some(
        (reminder) => reminder.kind === 'tray-change',
      ),
    ).toBe(false);
  });

  it('does not schedule a disabled or overdue tray reminder', () => {
    const tracker = snapshot();
    const dueDate = new Date(tracker.trayStartedAt);
    dueDate.setDate(dueDate.getDate() + tracker.daysPerTray);
    dueDate.setHours(9, 1, 0, 0);

    expect(
      buildReminderRequests(
        tracker,
        { ...DEFAULT_NOTIFICATION_SETTINGS, trayChangeReminderEnabled: false },
        tracker.trayStartedAt,
      ).some((reminder) => reminder.kind === 'tray-change'),
    ).toBe(false);
    expect(
      buildReminderRequests(tracker, DEFAULT_NOTIFICATION_SETTINGS, dueDate.getTime()).some(
        (reminder) => reminder.kind === 'tray-change',
      ),
    ).toBe(false);
  });
});

describe('planReminderReconciliation', () => {
  it('keeps one matching reminder and cancels duplicates', () => {
    const desired = buildReminderRequests(
      snapshot(),
      DEFAULT_NOTIFICATION_SETTINGS,
      snapshot().trayStartedAt,
    );
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
    const desired = buildReminderRequests(
      tracker,
      DEFAULT_NOTIFICATION_SETTINGS,
      tracker.trayStartedAt + 2 * MINUTE,
    );
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
    const desired = buildReminderRequests(
      snapshot(),
      DEFAULT_NOTIFICATION_SETTINGS,
      snapshot().trayStartedAt,
    );
    const result = planReminderReconciliation(desired, [
      { fingerprint: 'pending-out', identifier: 'pending-out-id', kind: 'out-too-long' },
    ]);

    expect(result.cancelIdentifiers).toEqual(['pending-out-id']);
    expect(result.schedule.some((reminder) => reminder.kind === 'out-too-long')).toBe(false);
  });

  it('cancels pending reminders when their preferences are disabled', () => {
    const desired = buildReminderRequests(
      snapshot({
        punches: [{ id: 2, status: 'OUT', timestamp: snapshot().trayStartedAt }],
      }),
      {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        outReminderEnabled: false,
        trayChangeReminderEnabled: false,
      },
      snapshot().trayStartedAt,
    );
    const result = planReminderReconciliation(desired, [
      { fingerprint: 'pending-out', identifier: 'out-id', kind: 'out-too-long' },
      { fingerprint: 'pending-tray', identifier: 'tray-id', kind: 'tray-change' },
    ]);

    expect(result).toEqual({ cancelIdentifiers: ['out-id', 'tray-id'], schedule: [] });
  });

  it('replaces the OUT reminder when its duration changes while trays are OUT', () => {
    const tracker = snapshot({
      punches: [{ id: 2, status: 'OUT', timestamp: snapshot().trayStartedAt }],
    });
    const desired = buildReminderRequests(
      tracker,
      { ...DEFAULT_NOTIFICATION_SETTINGS, outReminderMinutes: 60 },
      tracker.trayStartedAt + MINUTE,
    );
    const result = planReminderReconciliation(desired, [
      { fingerprint: 'out-too-long:old', identifier: 'old-out', kind: 'out-too-long' },
    ]);

    expect(result.cancelIdentifiers).toEqual(['old-out']);
    expect(result.schedule).toContainEqual(
      expect.objectContaining({
        kind: 'out-too-long',
        scheduledAt: tracker.trayStartedAt + 60 * MINUTE,
      }),
    );
  });

  it('replaces tray and OUT reminders after a tray change', () => {
    const changedTray = snapshot({
      currentTrayNumber: 10,
      punches: [{ id: 9, status: 'OUT', timestamp: snapshot().trayStartedAt + MINUTE }],
      trayPeriodId: 34,
      trayStartedAt: snapshot().trayStartedAt + MINUTE,
    });
    const desired = buildReminderRequests(
      changedTray,
      DEFAULT_NOTIFICATION_SETTINGS,
      changedTray.trayStartedAt,
    );
    const result = planReminderReconciliation(desired, [
      { fingerprint: 'previous-out', identifier: 'previous-out-id', kind: 'out-too-long' },
      { fingerprint: 'previous-tray', identifier: 'previous-tray-id', kind: 'tray-change' },
    ]);

    expect(result.cancelIdentifiers).toEqual(['previous-out-id', 'previous-tray-id']);
    expect(result.schedule.map((reminder) => reminder.kind)).toEqual([
      'tray-change',
      'out-too-long',
    ]);
  });

  it('replaces the tray reminder after plan or reminder-time changes', () => {
    const original = buildReminderRequests(
      snapshot(),
      DEFAULT_NOTIFICATION_SETTINGS,
      snapshot().trayStartedAt,
    ).find((reminder) => reminder.kind === 'tray-change');
    const desired = buildReminderRequests(
      snapshot({ daysPerTray: 10 }),
      { ...DEFAULT_NOTIFICATION_SETTINGS, trayChangeReminderHour: 14 },
      snapshot().trayStartedAt,
    );
    const result = planReminderReconciliation(desired, [
      {
        fingerprint: original?.fingerprint,
        identifier: 'original-tray-id',
        kind: 'tray-change',
      },
    ]);

    expect(result.cancelIdentifiers).toEqual(['original-tray-id']);
    expect(result.schedule).toEqual([
      expect.objectContaining({ kind: 'tray-change' }),
    ]);
  });
});
