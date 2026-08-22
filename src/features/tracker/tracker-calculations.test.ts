import {
  calculateDailyWearIntervals,
  calculateDailyWearTotals,
  calculateDaysRemaining,
  calculateTrayDay,
  createTrackerReadModel,
  formatDuration,
  getLatestWearPunch,
  getLocalDayStart,
} from '@/features/tracker/tracker-calculations';
import type {
  TrackerSnapshot,
  WearPunchEvent,
} from '@/features/tracker/tracker-model';

const HOUR_IN_MILLISECONDS = 60 * 60 * 1000;

function createSnapshot(punches: WearPunchEvent[]): TrackerSnapshot {
  return {
    currentTrayNumber: 9,
    daysPerTray: 7,
    punches,
    totalTrays: 48,
    trayPeriodId: 4,
    trayStartedAt: punches[0]?.timestamp ?? 0,
  };
}

describe('formatDuration', () => {
  it('displays hours, minutes, and seconds', () => {
    expect(formatDuration(20 * 60 * 60 + 17 * 60 + 32)).toBe('20:17:32');
  });

  it('keeps elapsed hours above a full day', () => {
    expect(formatDuration(27 * 60 * 60 + 5)).toBe('27:00:05');
  });

  it('clamps negative values and ignores fractional seconds', () => {
    expect(formatDuration(-1)).toBe('00:00:00');
    expect(formatDuration(1.9)).toBe('00:00:01');
  });
});

describe('tray day calculations', () => {
  it('treats the local start date as day one', () => {
    const trayStartedAt = new Date(2026, 7, 15, 8, 30).getTime();
    const laterThatDay = new Date(2026, 7, 15, 23, 45).getTime();

    expect(calculateTrayDay(trayStartedAt, laterThatDay)).toBe(1);
  });

  it('advances on the next local calendar date even before 24 elapsed hours', () => {
    const trayStartedAt = new Date(2026, 7, 15, 23, 30).getTime();
    const nextLocalDate = new Date(2026, 7, 16, 0, 30).getTime();

    expect(calculateTrayDay(trayStartedAt, nextLocalDate)).toBe(2);
  });

  it('clamps days remaining at zero', () => {
    expect(calculateDaysRemaining(7, 1)).toBe(6);
    expect(calculateDaysRemaining(7, 7)).toBe(0);
    expect(calculateDaysRemaining(7, 10)).toBe(0);
  });
});

describe('calculateDailyWearTotals', () => {
  it('counts a state that began before midnight and sessions crossing into today', () => {
    const dayStart = new Date(2026, 7, 15).getTime();
    const punches: WearPunchEvent[] = [
      { id: 1, status: 'IN', timestamp: dayStart - 2 * HOUR_IN_MILLISECONDS },
      { id: 2, status: 'OUT', timestamp: dayStart + HOUR_IN_MILLISECONDS },
      { id: 3, status: 'IN', timestamp: dayStart + 1.5 * HOUR_IN_MILLISECONDS },
    ];

    expect(
      calculateDailyWearTotals(punches, dayStart, dayStart + 3 * HOUR_IN_MILLISECONDS),
    ).toEqual({
      inSeconds: 2.5 * 60 * 60,
      outSeconds: 0.5 * 60 * 60,
    });
  });

  it('does not count time before a treatment starts during the day', () => {
    const dayStart = new Date(2026, 7, 15).getTime();
    const punches: WearPunchEvent[] = [
      { id: 1, status: 'IN', timestamp: dayStart + 10 * HOUR_IN_MILLISECONDS },
      { id: 2, status: 'OUT', timestamp: dayStart + 11 * HOUR_IN_MILLISECONDS },
    ];

    expect(
      calculateDailyWearTotals(punches, dayStart, dayStart + 12 * HOUR_IN_MILLISECONDS),
    ).toEqual({
      inSeconds: 60 * 60,
      outSeconds: 60 * 60,
    });
  });

  it('creates the live tracker read model from timestamps', () => {
    const now = new Date(2026, 7, 15, 12).getTime();
    const dayStart = getLocalDayStart(now);

    expect(
      createTrackerReadModel(
        {
          currentTrayNumber: 9,
          daysPerTray: 7,
          punches: [{ id: 1, status: 'IN', timestamp: dayStart }],
          totalTrays: 48,
          trayPeriodId: 4,
          trayStartedAt: new Date(2026, 7, 11, 9).getTime(),
        },
        now,
      ),
    ).toEqual({
      currentStatus: 'IN',
      currentOutSeconds: 0,
      currentTrayNumber: 9,
      daysRemaining: 2,
      inTodaySeconds: 12 * 60 * 60,
      outTodaySeconds: 0,
      totalTrays: 48,
      trayDay: 5,
    });
  });
});

describe('calculateDailyWearIntervals', () => {
  it('creates chronological intervals for ordinary transitions', () => {
    const dayStart = new Date(2026, 7, 15).getTime();
    const now = dayStart + 4 * HOUR_IN_MILLISECONDS;
    const punches: WearPunchEvent[] = [
      { id: 3, status: 'IN', timestamp: dayStart + 2 * HOUR_IN_MILLISECONDS },
      { id: 1, status: 'IN', timestamp: dayStart },
      { id: 2, status: 'OUT', timestamp: dayStart + HOUR_IN_MILLISECONDS },
    ];

    expect(calculateDailyWearIntervals(punches, dayStart, now)).toEqual([
      {
        durationSeconds: 60 * 60,
        endedAt: dayStart + HOUR_IN_MILLISECONDS,
        isOngoing: false,
        startedAt: dayStart,
        status: 'IN',
      },
      {
        durationSeconds: 60 * 60,
        endedAt: dayStart + 2 * HOUR_IN_MILLISECONDS,
        isOngoing: false,
        startedAt: dayStart + HOUR_IN_MILLISECONDS,
        status: 'OUT',
      },
      {
        durationSeconds: 2 * 60 * 60,
        endedAt: now,
        isOngoing: true,
        startedAt: dayStart + 2 * HOUR_IN_MILLISECONDS,
        status: 'IN',
      },
    ]);
  });

  it('clips an interval crossing midnight to the start of today', () => {
    const dayStart = new Date(2026, 7, 15).getTime();
    const now = dayStart + HOUR_IN_MILLISECONDS;

    expect(
      calculateDailyWearIntervals(
        [{ id: 1, status: 'OUT', timestamp: dayStart - HOUR_IN_MILLISECONDS }],
        dayStart,
        now,
      ),
    ).toEqual([
      {
        durationSeconds: 60 * 60,
        endedAt: now,
        isOngoing: true,
        startedAt: dayStart,
        status: 'OUT',
      },
    ]);
  });

  it('does not create an interval before treatment begins during the day', () => {
    const dayStart = new Date(2026, 7, 15).getTime();
    const treatmentStartedAt = dayStart + 10 * HOUR_IN_MILLISECONDS;
    const now = dayStart + 12 * HOUR_IN_MILLISECONDS;

    expect(
      calculateDailyWearIntervals(
        [{ id: 1, status: 'IN', timestamp: treatmentStartedAt }],
        dayStart,
        now,
      ),
    ).toEqual([
      {
        durationSeconds: 2 * 60 * 60,
        endedAt: now,
        isOngoing: true,
        startedAt: treatmentStartedAt,
        status: 'IN',
      },
    ]);
  });

  it('coalesces redundant same-status punches across tray changes', () => {
    const dayStart = new Date(2026, 7, 15).getTime();
    const trayChangeAt = dayStart + HOUR_IN_MILLISECONDS;
    const now = dayStart + 2 * HOUR_IN_MILLISECONDS;

    expect(
      calculateDailyWearIntervals(
        [
          { id: 1, status: 'OUT', timestamp: dayStart },
          { id: 2, status: 'OUT', timestamp: trayChangeAt },
          { id: 3, status: 'OUT', timestamp: trayChangeAt },
        ],
        dayStart,
        now,
      ),
    ).toEqual([
      {
        durationSeconds: 2 * 60 * 60,
        endedAt: now,
        isOngoing: true,
        startedAt: dayStart,
        status: 'OUT',
      },
    ]);
  });

  it('uses timestamp and id ordering for equal-time transitions and ignores future punches', () => {
    const dayStart = new Date(2026, 7, 15).getTime();
    const transitionAt = dayStart + HOUR_IN_MILLISECONDS;
    const now = dayStart + 2 * HOUR_IN_MILLISECONDS;

    expect(
      calculateDailyWearIntervals(
        [
          { id: 4, status: 'IN', timestamp: transitionAt },
          { id: 1, status: 'IN', timestamp: dayStart },
          { id: 3, status: 'OUT', timestamp: transitionAt },
          { id: 5, status: 'OUT', timestamp: now + HOUR_IN_MILLISECONDS },
        ],
        dayStart,
        now,
      ),
    ).toEqual([
      {
        durationSeconds: 2 * 60 * 60,
        endedAt: now,
        isOngoing: true,
        startedAt: dayStart,
        status: 'IN',
      },
    ]);
  });

  it('returns no intervals for empty input or when now is not after day start', () => {
    const dayStart = new Date(2026, 7, 15).getTime();

    expect(calculateDailyWearIntervals([], dayStart, dayStart + HOUR_IN_MILLISECONDS)).toEqual([]);
    expect(
      calculateDailyWearIntervals(
        [{ id: 1, status: 'IN', timestamp: dayStart }],
        dayStart,
        dayStart,
      ),
    ).toEqual([]);
  });

  it('allocates whole seconds so interval sums match daily totals by status', () => {
    const dayStart = new Date(2026, 7, 15).getTime();
    const punches: WearPunchEvent[] = [
      { id: 1, status: 'IN', timestamp: dayStart },
      { id: 2, status: 'OUT', timestamp: dayStart + 1_500 },
      { id: 3, status: 'IN', timestamp: dayStart + 3_000 },
      { id: 4, status: 'OUT', timestamp: dayStart + 4_500 },
    ];
    const now = dayStart + 6_000;
    const intervals = calculateDailyWearIntervals(punches, dayStart, now);
    const totals = calculateDailyWearTotals(punches, dayStart, now);

    expect(
      intervals
        .filter((interval) => interval.status === 'IN')
        .reduce((sum, interval) => sum + interval.durationSeconds, 0),
    ).toBe(totals.inSeconds);
    expect(
      intervals
        .filter((interval) => interval.status === 'OUT')
        .reduce((sum, interval) => sum + interval.durationSeconds, 0),
    ).toBe(totals.outSeconds);
    expect(intervals.map((interval) => interval.durationSeconds)).toEqual([1, 1, 2, 2]);
  });
});

describe('current OUT duration', () => {
  it('measures from the effective latest OUT punch in unordered history', () => {
    const now = new Date(2026, 7, 15, 12).getTime();
    const punches: WearPunchEvent[] = [
      { id: 3, status: 'OUT', timestamp: now - 5_900 },
      { id: 1, status: 'OUT', timestamp: now - 60_000 },
      { id: 2, status: 'IN', timestamp: now - 30_000 },
    ];

    expect(createTrackerReadModel(createSnapshot(punches), now).currentOutSeconds).toBe(5);
  });

  it('returns zero while trays are IN', () => {
    const now = new Date(2026, 7, 15, 12).getTime();
    const punches: WearPunchEvent[] = [
      { id: 1, status: 'OUT', timestamp: now - HOUR_IN_MILLISECONDS },
      { id: 2, status: 'IN', timestamp: now - 5_000 },
    ];

    expect(createTrackerReadModel(createSnapshot(punches), now).currentOutSeconds).toBe(0);
  });

  it('continues measuring the current OUT interval across midnight', () => {
    const outAt = new Date(2026, 7, 14, 23, 30).getTime();
    const now = new Date(2026, 7, 15, 0, 15).getTime();

    expect(
      createTrackerReadModel(
        createSnapshot([{ id: 1, status: 'OUT', timestamp: outAt }]),
        now,
      ).currentOutSeconds,
    ).toBe(45 * 60);
  });
});

describe('getLatestWearPunch', () => {
  it('selects the chronologically latest punch from unordered input', () => {
    const punches: WearPunchEvent[] = [
      { id: 2, status: 'OUT', timestamp: 300 },
      { id: 3, status: 'IN', timestamp: 200 },
      { id: 1, status: 'IN', timestamp: 100 },
    ];

    expect(getLatestWearPunch(punches)).toEqual(punches[0]);
  });

  it('uses the higher ID when punches have the same timestamp', () => {
    const punches: WearPunchEvent[] = [
      { id: 8, status: 'OUT', timestamp: 300 },
      { id: 10, status: 'IN', timestamp: 300 },
      { id: 9, status: 'OUT', timestamp: 300 },
    ];

    expect(getLatestWearPunch(punches)).toEqual(punches[1]);
  });
});
