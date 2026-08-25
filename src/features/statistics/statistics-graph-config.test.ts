import {
  getStatisticsGraphDefinition,
  parseStatisticsGraphKind,
  STATISTICS_GRAPHS,
} from '@/features/statistics/statistics-graph-config';

describe('statistics graph configuration', () => {
  it('defines the three graph destinations without preview data', () => {
    expect(STATISTICS_GRAPHS.map((graph) => graph.kind)).toEqual([
      'wear-time',
      'goal-progress',
      'tray-progress',
    ]);
    expect(getStatisticsGraphDefinition('goal-progress').title).toBe('Goal Progress');
  });

  it('parses valid route parameters and rejects unknown graph identifiers', () => {
    expect(parseStatisticsGraphKind('wear-time')).toBe('wear-time');
    expect(parseStatisticsGraphKind(['tray-progress'])).toBe('tray-progress');
    expect(parseStatisticsGraphKind('unknown')).toBeNull();
    expect(parseStatisticsGraphKind(undefined)).toBeNull();
  });
});
