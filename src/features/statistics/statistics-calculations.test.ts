import {
  createStatisticsReadModel,
  formatStatisticsDuration,
} from '@/features/statistics/statistics-calculations';
import type {
  StatisticsPlanVersion,
  StatisticsSnapshot,
  StatisticsTrayPeriod,
  StatisticsWearPunch,
} from '@/features/statistics/statistics-model';

const HOUR_IN_SECONDS = 60 * 60;

function at(day: number, hour = 0, minute = 0) {
  return new Date(2026, 7, day, hour, minute).getTime();
}

function plan(
  dailyWearGoalHours: number,
  effectiveAt = at(1),
  id = 1,
): StatisticsPlanVersion {
  return {
    dailyWearGoalMinutes: dailyWearGoalHours * 60,
    effectiveAt,
    id,
  };
}

function period(
  id: number,
  startedAt: number,
  endedAt: number | null,
  trayNumber = id,
): StatisticsTrayPeriod {
  return { endedAt, id, startedAt, trayNumber };
}

function punch(
  id: number,
  status: 'IN' | 'OUT',
  timestamp: number,
  trayPeriodId = 1,
): StatisticsWearPunch {
  return { id, status, timestamp, trayPeriodId };
}

function snapshot(
  punches: StatisticsWearPunch[],
  trayPeriods: StatisticsTrayPeriod[],
  planVersions: StatisticsPlanVersion[] = [plan(22)],
): StatisticsSnapshot {
  return { planVersions, punches, trayPeriods };
}

describe('Statistics V1 calculations', () => {
  it('calculates current tray days, averages, and goal count from the active period only', () => {
    const treatment = snapshot(
      [
        punch(1, 'IN', at(1, 8)),
        punch(2, 'OUT', at(3, 18)),
        punch(3, 'OUT', at(3, 18), 2),
        punch(4, 'IN', at(3, 19), 2),
      ],
      [period(1, at(1, 8), at(3, 18)), period(2, at(3, 18), null)],
      [plan(10)],
    );

    expect(createStatisticsReadModel(treatment, at(4, 20)).currentTray).toEqual({
      averageInSeconds: 12.5 * HOUR_IN_SECONDS,
      averageOutSeconds: 0.5 * HOUR_IN_SECONDS,
      daysWorn: 2,
      goalMetDays: 1,
      trackedDays: 2,
    });
  });

  it('calculates treatment-wide averages and newest-first recent days', () => {
    const treatment = snapshot(
      [
        punch(1, 'IN', at(1, 6)),
        punch(2, 'OUT', at(1, 22)),
        punch(3, 'IN', at(2, 2)),
        punch(4, 'OUT', at(3, 10)),
      ],
      [period(1, at(1, 6), null)],
      [plan(12)],
    );
    const statistics = createStatisticsReadModel(treatment, at(3, 18));

    expect(statistics.treatmentOverall).toEqual({
      averageInSeconds: 64_000,
      averageOutSeconds: 15_200,
      goalMetDays: 2,
      trackedDays: 3,
    });
    expect(statistics.recentDays).toEqual([
      {
        dateStart: at(3),
        goalMet: false,
        inSeconds: 10 * HOUR_IN_SECONDS,
        outSeconds: 8 * HOUR_IN_SECONDS,
      },
      {
        dateStart: at(2),
        goalMet: true,
        inSeconds: 22 * HOUR_IN_SECONDS,
        outSeconds: 2 * HOUR_IN_SECONDS,
      },
      {
        dateStart: at(1),
        goalMet: true,
        inSeconds: 16 * HOUR_IN_SECONDS,
        outSeconds: 2 * HOUR_IN_SECONDS,
      },
    ]);
  });

  it('combines multiple tray periods overall without combining an earlier matching tray number into current tray', () => {
    const treatment = snapshot(
      [
        punch(1, 'IN', at(1), 1),
        punch(2, 'OUT', at(2), 1),
        punch(3, 'OUT', at(2), 2),
        punch(4, 'IN', at(2, 1), 2),
        punch(5, 'OUT', at(3), 2),
        punch(6, 'OUT', at(3), 3),
        punch(7, 'IN', at(3, 2), 3),
      ],
      [
        period(1, at(1), at(2), 8),
        period(2, at(2), at(3), 9),
        period(3, at(3), null, 8),
      ],
      [plan(20)],
    );
    const statistics = createStatisticsReadModel(treatment, at(3, 12));

    expect(statistics.treatmentOverall.trackedDays).toBe(3);
    expect(statistics.treatmentOverall.averageInSeconds).toBe(
      (24 + 23 + 10) / 3 * HOUR_IN_SECONDS,
    );
    expect(statistics.currentTray).toMatchObject({
      averageInSeconds: 10 * HOUR_IN_SECONDS,
      averageOutSeconds: 2 * HOUR_IN_SECONDS,
      daysWorn: 1,
      trackedDays: 1,
    });
  });

  it('uses treatment-plan changes for later days without changing derived durations', () => {
    const treatment = snapshot(
      [
        punch(1, 'IN', at(1)),
        punch(2, 'OUT', at(1, 20)),
        punch(3, 'IN', at(2)),
        punch(4, 'OUT', at(2, 20)),
        punch(5, 'IN', at(3)),
        punch(6, 'OUT', at(3, 20)),
      ],
      [period(1, at(1), null)],
      [plan(22), plan(18, at(3), 2)],
    );
    const statistics = createStatisticsReadModel(treatment, at(3, 23));

    expect(statistics.treatmentOverall.averageInSeconds).toBe(20 * HOUR_IN_SECONDS);
    expect(statistics.recentDays.map((day) => day.goalMet)).toEqual([true, false, false]);
  });

  it('selects the plan effective at the start of each day and breaks equal times by version id', () => {
    const treatment = snapshot(
      [punch(1, 'IN', at(1)), punch(2, 'OUT', at(1, 20)), punch(3, 'IN', at(2))],
      [period(1, at(1), null)],
      [
        plan(22),
        plan(19, at(1, 12), 2),
        plan(21, at(1, 12), 3),
      ],
    );
    const statistics = createStatisticsReadModel(treatment, at(2, 21));

    expect(statistics.recentDays.map((day) => day.goalMet)).toEqual([true, false]);
    expect(statistics.treatmentOverall.goalMetDays).toBe(1);
  });

  it('normalizes a completed first day while leaving recorded recent-day durations raw', () => {
    const treatment = snapshot(
      [
        punch(1, 'IN', at(1, 12)),
        punch(2, 'OUT', at(1, 21)),
        punch(3, 'IN', at(2)),
      ],
      [period(1, at(1, 12), null)],
      [plan(22, at(1, 12))],
    );
    const statistics = createStatisticsReadModel(treatment, at(2, 12));

    expect(statistics.treatmentOverall).toEqual({
      averageInSeconds: 15 * HOUR_IN_SECONDS,
      averageOutSeconds: 3 * HOUR_IN_SECONDS,
      goalMetDays: 0,
      trackedDays: 2,
    });
    expect(statistics.currentTray).toMatchObject({
      averageInSeconds: 15 * HOUR_IN_SECONDS,
      averageOutSeconds: 3 * HOUR_IN_SECONDS,
    });
    expect(statistics.recentDays).toEqual([
      {
        dateStart: at(2),
        goalMet: false,
        inSeconds: 12 * HOUR_IN_SECONDS,
        outSeconds: 0,
      },
      {
        dateStart: at(1),
        goalMet: false,
        inSeconds: 9 * HOUR_IN_SECONDS,
        outSeconds: 3 * HOUR_IN_SECONDS,
      },
    ]);
  });

  it('uses raw elapsed averages and a fixed prorated goal during the first day', () => {
    const treatment = snapshot(
      [punch(1, 'IN', at(1, 12))],
      [period(1, at(1, 12), null)],
      [plan(22, at(1, 12))],
    );
    const statistics = createStatisticsReadModel(treatment, at(1, 18));

    expect(statistics.treatmentOverall).toEqual({
      averageInSeconds: 6 * HOUR_IN_SECONDS,
      averageOutSeconds: 0,
      goalMetDays: 0,
      trackedDays: 1,
    });
    expect(statistics.recentDays[0]).toMatchObject({
      goalMet: false,
      inSeconds: 6 * HOUR_IN_SECONDS,
      outSeconds: 0,
    });
  });

  it('meets the prorated first-day goal at the exact boundary', () => {
    const trayPeriods = [period(1, at(1, 12), null)];
    const plans = [plan(22, at(1, 12))];
    const belowGoal = snapshot(
      [
        punch(1, 'IN', at(1, 12)),
        punch(2, 'OUT', at(1, 22, 59)),
        punch(3, 'IN', at(2)),
      ],
      trayPeriods,
      plans,
    );
    const atGoal = snapshot(
      [
        punch(1, 'IN', at(1, 12)),
        punch(2, 'OUT', at(1, 23)),
        punch(3, 'IN', at(2)),
      ],
      trayPeriods,
      plans,
    );

    expect(createStatisticsReadModel(belowGoal, at(2, 1)).recentDays[1].goalMet).toBe(
      false,
    );
    expect(createStatisticsReadModel(atGoal, at(2, 1)).recentDays[1].goalMet).toBe(
      true,
    );
  });

  it('includes partial first and current days without counting untracked clock time', () => {
    const treatment = snapshot(
      [punch(1, 'IN', at(1, 10))],
      [period(1, at(1, 10), null)],
      [plan(14, at(1, 10))],
    );
    const statistics = createStatisticsReadModel(treatment, at(2, 12));

    expect(statistics.treatmentOverall).toEqual({
      averageInSeconds: 18 * HOUR_IN_SECONDS,
      averageOutSeconds: 0,
      goalMetDays: 1,
      trackedDays: 2,
    });
    expect(statistics.recentDays.map((day) => day.inSeconds)).toEqual([
      12 * HOUR_IN_SECONDS,
      14 * HOUR_IN_SECONDS,
    ]);
  });

  it('does not normalize a later tray that starts on the first treatment date', () => {
    const treatment = snapshot(
      [
        punch(1, 'IN', at(1, 12), 1),
        punch(2, 'OUT', at(1, 14), 1),
        punch(3, 'OUT', at(1, 14), 2),
        punch(4, 'IN', at(1, 15), 2),
      ],
      [period(1, at(1, 12), at(1, 14)), period(2, at(1, 14), null)],
      [plan(22, at(1, 12))],
    );
    const statistics = createStatisticsReadModel(treatment, at(2, 12));

    expect(statistics.currentTray).toMatchObject({
      averageInSeconds: 10.5 * HOUR_IN_SECONDS,
      averageOutSeconds: 0.5 * HOUR_IN_SECONDS,
      daysWorn: 2,
      trackedDays: 2,
    });
  });

  it('leaves a midnight treatment start unchanged', () => {
    const treatment = snapshot(
      [
        punch(1, 'IN', at(1)),
        punch(2, 'OUT', at(1, 9)),
        punch(3, 'IN', at(2)),
      ],
      [period(1, at(1), null)],
      [plan(22)],
    );
    const statistics = createStatisticsReadModel(treatment, at(2, 12));

    expect(statistics.treatmentOverall).toMatchObject({
      averageInSeconds: 10.5 * HOUR_IN_SECONDS,
      averageOutSeconds: 7.5 * HOUR_IN_SECONDS,
    });
  });

  it('normalizes with the actual local-day duration across daylight-saving time', () => {
    const previousTimeZone = process.env.TZ;
    process.env.TZ = 'America/New_York';

    try {
      const dstAt = (day: number, hour = 0) =>
        new Date(2026, 2, day, hour).getTime();
      const treatment = snapshot(
        [
          punch(1, 'IN', dstAt(8, 12)),
          punch(2, 'OUT', dstAt(8, 18)),
          punch(3, 'IN', dstAt(9)),
        ],
        [period(1, dstAt(8, 12), null)],
        [plan(22, dstAt(8, 12))],
      );
      const statistics = createStatisticsReadModel(treatment, dstAt(9, 12));

      expect(dstAt(9) - dstAt(8)).toBe(23 * HOUR_IN_SECONDS * 1000);
      expect(statistics.treatmentOverall).toMatchObject({
        averageInSeconds: 11.75 * HOUR_IN_SECONDS,
        averageOutSeconds: 5.75 * HOUR_IN_SECONDS,
      });
    } finally {
      if (previousTimeZone === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = previousTimeZone;
      }
    }
  });

  it('splits a midnight-crossing wear period between local treatment days', () => {
    const treatment = snapshot(
      [punch(1, 'IN', at(1, 20)), punch(2, 'OUT', at(2, 2))],
      [period(1, at(1, 20), null)],
      [plan(4, at(1, 20))],
    );
    const statistics = createStatisticsReadModel(treatment, at(2, 4));

    expect(statistics.recentDays).toEqual([
      {
        dateStart: at(2),
        goalMet: false,
        inSeconds: 2 * HOUR_IN_SECONDS,
        outSeconds: 2 * HOUR_IN_SECONDS,
      },
      {
        dateStart: at(1),
        goalMet: true,
        inSeconds: 4 * HOUR_IN_SECONDS,
        outSeconds: 0,
      },
    ]);
  });

  it('recalculates from corrected punch timestamps instead of retaining derived totals', () => {
    const trayPeriods = [period(1, at(1), null)];
    const plans = [plan(21)];
    const beforeCorrection = snapshot(
      [punch(1, 'IN', at(1)), punch(2, 'OUT', at(1, 20))],
      trayPeriods,
      plans,
    );
    const afterCorrection = snapshot(
      [punch(1, 'IN', at(1)), punch(2, 'OUT', at(1, 21))],
      trayPeriods,
      plans,
    );

    expect(createStatisticsReadModel(beforeCorrection, at(1, 23)).recentDays[0]).toMatchObject({
      goalMet: false,
      inSeconds: 20 * HOUR_IN_SECONDS,
      outSeconds: 3 * HOUR_IN_SECONDS,
    });
    expect(createStatisticsReadModel(afterCorrection, at(1, 23)).recentDays[0]).toMatchObject({
      goalMet: true,
      inSeconds: 21 * HOUR_IN_SECONDS,
      outSeconds: 2 * HOUR_IN_SECONDS,
    });
  });

  it.each([
    ['IN', 'averageInSeconds'],
    ['OUT', 'averageOutSeconds'],
  ] as const)('continues an unchanged %s state across days', (status, averageKey) => {
    const treatment = snapshot(
      [punch(1, status, at(1))],
      [period(1, at(1), null)],
      [plan(22)],
    );
    const statistics = createStatisticsReadModel(treatment, at(3, 6));

    expect(statistics.treatmentOverall[averageKey]).toBe(18 * HOUR_IN_SECONDS);
    expect(statistics.recentDays).toHaveLength(3);
  });

  it('limits recent treatment days to seven in newest-first order', () => {
    const treatment = snapshot(
      [punch(1, 'IN', at(1))],
      [period(1, at(1), null)],
      [plan(22)],
    );
    const statistics = createStatisticsReadModel(treatment, at(9, 12));

    expect(statistics.recentDays.map((day) => day.dateStart)).toEqual([
      at(9),
      at(8),
      at(7),
      at(6),
      at(5),
      at(4),
      at(3),
    ]);
  });
});

describe('formatStatisticsDuration', () => {
  it('formats durations at minute precision', () => {
    expect(formatStatisticsDuration(21 * HOUR_IN_SECONDS + 34 * 60 + 59)).toBe('21h 34m');
    expect(formatStatisticsDuration(42 * 60)).toBe('42m');
    expect(formatStatisticsDuration(-1)).toBe('0m');
  });
});
