import {
  calculateDailyWearTotals,
  calculateDaysRemaining,
  calculateTrayDay,
  createTrackerReadModel,
  formatDuration,
  getLocalDayStart,
} from '@/features/tracker/tracker-calculations';
import type { WearPunchEvent } from '@/features/tracker/tracker-model';

const HOUR_IN_MILLISECONDS = 60 * 60 * 1000;

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
      currentTrayNumber: 9,
      daysRemaining: 2,
      inTodaySeconds: 12 * 60 * 60,
      outTodaySeconds: 0,
      totalTrays: 48,
      trayDay: 5,
    });
  });
});
