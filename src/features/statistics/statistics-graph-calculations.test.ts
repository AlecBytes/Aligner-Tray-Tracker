import {
  createStatisticsGraphReadModel,
  formatStatisticsGoalDifference,
  formatStatisticsTrayDuration,
} from '@/features/statistics/statistics-calculations';
import type {
  StatisticsPlanVersion,
  StatisticsSnapshot,
  StatisticsTrayPeriod,
  StatisticsWearPunch,
} from '@/features/statistics/statistics-model';

const HOUR_IN_SECONDS = 60 * 60;
const DAY_IN_SECONDS = 24 * HOUR_IN_SECONDS;

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
    daysPerTray: 7,
    effectiveAt,
    id,
    totalTrays: 48,
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

describe('Statistics graph calculations', () => {
  it('builds 7-day and 30-day ranges from local dates and clamps them to treatment start', () => {
    const treatment = snapshot(
      [punch(1, 'IN', at(1, 10))],
      [period(1, at(1, 10), null)],
      [plan(22, at(1, 10))],
    );

    const sevenDays = createStatisticsGraphReadModel(treatment, '7-days', at(20, 12));
    const thirtyDays = createStatisticsGraphReadModel(treatment, '30-days', at(20, 12));

    expect(sevenDays.rangeStartedAt).toBe(at(14));
    expect(sevenDays.dailyPoints).toHaveLength(7);
    expect(sevenDays.dailyPoints.map((point) => point.dateStart)).toEqual([
      at(14),
      at(15),
      at(16),
      at(17),
      at(18),
      at(19),
      at(20),
    ]);
    expect(thirtyDays.rangeStartedAt).toBe(at(1, 10));
    expect(thirtyDays.dailyPoints).toHaveLength(20);
  });

  it('uses treatment start for the full-treatment range', () => {
    const treatment = snapshot(
      [punch(1, 'IN', at(1, 10))],
      [period(1, at(1, 10), null)],
      [plan(22, at(1, 10))],
    );

    const graph = createStatisticsGraphReadModel(treatment, 'treatment', at(3, 12));

    expect(graph.rangeStartedAt).toBe(at(1, 10));
    expect(graph.rangeEndedAt).toBe(at(3, 12));
    expect(graph.dailyPoints.map((point) => point.dateStart)).toEqual([
      at(1),
      at(2),
      at(3),
    ]);
  });

  it('selects the historical goal at each day start and breaks equal times by version id', () => {
    const treatment = snapshot(
      [punch(1, 'IN', at(1))],
      [period(1, at(1), null)],
      [
        plan(22),
        plan(18, at(2, 12), 2),
        plan(20, at(2, 12), 3),
      ],
    );

    const graph = createStatisticsGraphReadModel(treatment, 'treatment', at(3, 23));

    expect(graph.dailyPoints.map((point) => point.goalSeconds)).toEqual([
      22 * HOUR_IN_SECONDS,
      22 * HOUR_IN_SECONDS,
      20 * HOUR_IN_SECONDS,
    ]);
    expect(graph.dailyPoints.map((point) => point.goalDifferenceSeconds)).toEqual([
      2 * HOUR_IN_SECONDS,
      2 * HOUR_IN_SECONDS,
      3 * HOUR_IN_SECONDS,
    ]);
    expect(graph.dailyPoints.every((point) => point.goalMet)).toBe(true);
  });

  it('uses the prorated first-day goal and recognizes the exact boundary', () => {
    const treatment = snapshot(
      [
        punch(1, 'IN', at(1, 12)),
        punch(2, 'OUT', at(1, 23)),
        punch(3, 'IN', at(2)),
      ],
      [period(1, at(1, 12), null)],
      [plan(22, at(1, 12))],
    );

    const firstDay = createStatisticsGraphReadModel(
      treatment,
      'treatment',
      at(2, 1),
    ).dailyPoints[0];

    expect(firstDay).toMatchObject({
      goalDifferenceSeconds: 0,
      goalMet: true,
      goalSeconds: 11 * HOUR_IN_SECONDS,
      inSeconds: 11 * HOUR_IN_SECONDS,
    });
  });

  it('clips tray periods to the selected range and preserves treatment-wide occurrence labels', () => {
    const treatment = snapshot(
      [punch(1, 'IN', at(1))],
      [
        period(1, at(1), at(5), 8),
        period(2, at(5), at(10), 9),
        period(3, at(10), null, 8),
      ],
    );

    const graph = createStatisticsGraphReadModel(treatment, '7-days', at(12));

    expect(graph.rangeStartedAt).toBe(at(6));
    expect(graph.trayPeriods).toEqual([
      {
        durationSeconds: 4 * DAY_IN_SECONDS,
        endedAt: at(10),
        id: 2,
        isActive: false,
        label: 'Tray 9',
        startedAt: at(6),
        trayNumber: 9,
      },
      {
        durationSeconds: 2 * DAY_IN_SECONDS,
        endedAt: at(12),
        id: 3,
        isActive: true,
        label: 'Tray 8 · Period 2',
        startedAt: at(10),
        trayNumber: 8,
      },
    ]);
  });

  it('keeps stable period ordering and excludes periods outside the range', () => {
    const treatment = snapshot(
      [punch(1, 'IN', at(1))],
      [
        period(3, at(10), null, 8),
        period(2, at(5), at(10), 9),
        period(1, at(1), at(5), 8),
      ],
    );

    const graph = createStatisticsGraphReadModel(treatment, '7-days', at(12));

    expect(graph.trayPeriods.map((point) => point.id)).toEqual([2, 3]);
  });

  it('iterates local graph dates correctly across daylight-saving time', () => {
    const previousTimeZone = process.env.TZ;
    process.env.TZ = 'America/New_York';

    try {
      const dstAt = (day: number, hour = 0) =>
        new Date(2026, 2, day, hour).getTime();
      const treatment = snapshot(
        [punch(1, 'IN', dstAt(8))],
        [period(1, dstAt(8), null)],
        [plan(22, dstAt(8))],
      );

      const graph = createStatisticsGraphReadModel(treatment, '7-days', dstAt(14, 12));

      expect(graph.dailyPoints).toHaveLength(7);
      expect(graph.dailyPoints.map((point) => new Date(point.dateStart).getDate())).toEqual([
        8,
        9,
        10,
        11,
        12,
        13,
        14,
      ]);
      expect(dstAt(9) - dstAt(8)).toBe(23 * HOUR_IN_SECONDS * 1000);
    } finally {
      if (previousTimeZone === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = previousTimeZone;
      }
    }
  });

  it('formats goal margins and elapsed tray durations at minute precision', () => {
    expect(formatStatisticsGoalDifference(0)).toBe('Goal met exactly');
    expect(formatStatisticsGoalDifference(90 * 60)).toBe('Met by 1h 30m');
    expect(formatStatisticsGoalDifference(-45 * 60)).toBe('Short by 45m');
    expect(formatStatisticsTrayDuration(2 * DAY_IN_SECONDS + 3 * HOUR_IN_SECONDS)).toBe(
      '2d 3h 0m',
    );
  });
});
