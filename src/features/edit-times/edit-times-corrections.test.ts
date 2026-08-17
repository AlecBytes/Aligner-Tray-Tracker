import {
  assertValidWearTimeline,
  CorrectionValidationError,
  planMissingWearPeriod,
  validateEditedPunchTimestamp,
} from '@/features/edit-times/edit-times-corrections';
import type {
  EditableWearPunch,
  TrayPeriodWindow,
} from '@/features/edit-times/edit-times-model';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const period: TrayPeriodWindow = {
  endedAt: 8 * DAY,
  id: 33,
  startedAt: 0,
};

function punch(
  id: number,
  status: 'IN' | 'OUT',
  timestamp: number,
): EditableWearPunch {
  return { id, status, timestamp, trayPeriodId: period.id };
}

describe('editing a wear punch timestamp', () => {
  const punches = [
    punch(1, 'IN', 8 * HOUR),
    punch(2, 'OUT', 12 * HOUR),
    punch(3, 'IN', 13 * HOUR),
  ];

  it('accepts a correction between the preceding and following punches', () => {
    expect(() =>
      validateEditedPunchTimestamp(period, punches, 2, 12 * HOUR + 15 * 60 * 1000),
    ).not.toThrow();
  });

  it('rejects a timestamp before the preceding punch', () => {
    expect(() =>
      validateEditedPunchTimestamp(period, punches, 2, 7 * HOUR),
    ).toThrow('after the preceding punch');
  });

  it('rejects a timestamp after the following punch', () => {
    expect(() =>
      validateEditedPunchTimestamp(period, punches, 2, 14 * HOUR),
    ).toThrow('before the following punch');
  });

  it('rejects a timestamp outside the associated tray period', () => {
    expect(() =>
      validateEditedPunchTimestamp(period, punches, 1, -1),
    ).toThrow('within this tray period');
  });

  it('supports corrections on previous days', () => {
    const previousDayPunches = [
      punch(10, 'IN', 2 * DAY + 8 * HOUR),
      punch(11, 'OUT', 2 * DAY + 12 * HOUR),
      punch(12, 'IN', 2 * DAY + 13 * HOUR),
    ];

    expect(() =>
      validateEditedPunchTimestamp(
        period,
        previousDayPunches,
        11,
        2 * DAY + 12 * HOUR + 30 * 60 * 1000,
      ),
    ).not.toThrow();
  });
});

describe('adding missing wear time', () => {
  it('plans an OUT period as an OUT transition followed by IN', () => {
    const punches = [punch(1, 'IN', 8 * HOUR), punch(2, 'OUT', 15 * HOUR)];

    expect(
      planMissingWearPeriod(period, punches, {
        endTimestamp: 13 * HOUR,
        startTimestamp: 12 * HOUR,
        status: 'OUT',
      }),
    ).toEqual([
      { status: 'OUT', timestamp: 12 * HOUR },
      { status: 'IN', timestamp: 13 * HOUR },
    ]);
  });

  it('plans an IN period as an IN transition followed by OUT', () => {
    const punches = [punch(1, 'OUT', 8 * HOUR), punch(2, 'IN', 15 * HOUR)];

    expect(
      planMissingWearPeriod(period, punches, {
        endTimestamp: 13 * HOUR,
        startTimestamp: 12 * HOUR,
        status: 'IN',
      }),
    ).toEqual([
      { status: 'IN', timestamp: 12 * HOUR },
      { status: 'OUT', timestamp: 13 * HOUR },
    ]);
  });

  it('rejects an insertion that would not alternate', () => {
    const punches = [punch(1, 'IN', 8 * HOUR), punch(2, 'OUT', 15 * HOUR)];

    expect(() =>
      planMissingWearPeriod(period, punches, {
        endTimestamp: 13 * HOUR,
        startTimestamp: 12 * HOUR,
        status: 'IN',
      }),
    ).toThrow('already recorded as IN');
  });

  it('rejects a period whose end is not later than its start', () => {
    const punches = [punch(1, 'IN', 8 * HOUR), punch(2, 'OUT', 15 * HOUR)];

    expect(() =>
      planMissingWearPeriod(period, punches, {
        endTimestamp: 12 * HOUR,
        startTimestamp: 12 * HOUR,
        status: 'OUT',
      }),
    ).toThrow('later than start time');
  });

  it('rejects a period that overlaps an existing punch', () => {
    const punches = [
      punch(1, 'IN', 8 * HOUR),
      punch(2, 'OUT', 12 * HOUR),
      punch(3, 'IN', 13 * HOUR),
    ];

    expect(() =>
      planMissingWearPeriod(period, punches, {
        endTimestamp: 12 * HOUR + 30 * 60 * 1000,
        startTimestamp: 11 * HOUR,
        status: 'OUT',
      }),
    ).toThrow('overlaps existing punch history');
  });

  it('rejects a saved non-alternating timeline before making a correction', () => {
    expect(() =>
      assertValidWearTimeline(period, [
        punch(1, 'IN', 8 * HOUR),
        punch(2, 'IN', 9 * HOUR),
      ]),
    ).toThrow(CorrectionValidationError);
  });

  it('allows a missing period to cross midnight within one tray period', () => {
    const punches = [
      punch(1, 'IN', 22 * HOUR),
      punch(2, 'OUT', DAY + 2 * HOUR),
    ];

    expect(
      planMissingWearPeriod(period, punches, {
        endTimestamp: DAY + 30 * 60 * 1000,
        startTimestamp: 23 * HOUR + 30 * 60 * 1000,
        status: 'OUT',
      }),
    ).toHaveLength(2);
  });

  it('accepts a correction just inside tray-change boundaries', () => {
    const shortPeriod = { endedAt: 10 * HOUR, id: 40, startedAt: 8 * HOUR };
    const punches = [{ ...punch(1, 'OUT', 8 * HOUR), trayPeriodId: shortPeriod.id }];

    expect(() =>
      planMissingWearPeriod(shortPeriod, punches, {
        endTimestamp: 10 * HOUR,
        startTimestamp: 8 * HOUR + 1,
        status: 'IN',
      }),
    ).not.toThrow();
  });

  it('rejects a correction that crosses a tray-change boundary', () => {
    const shortPeriod = { endedAt: 10 * HOUR, id: 40, startedAt: 8 * HOUR };
    const punches = [{ ...punch(1, 'OUT', 8 * HOUR), trayPeriodId: shortPeriod.id }];

    expect(() =>
      planMissingWearPeriod(shortPeriod, punches, {
        endTimestamp: 10 * HOUR + 1,
        startTimestamp: 9 * HOUR,
        status: 'IN',
      }),
    ).toThrow('within one tray period');
  });
});
