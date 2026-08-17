import type { TreatmentPlanVersion } from '@/db/schema';
import {
  createTreatmentPlanHistoryReadModel,
  formatPrescribedMinutes,
} from '@/features/treatment/treatment-plan-history-model';

const NEWEST_VERSION: TreatmentPlanVersion = {
  createdAt: 300,
  dailyWearGoalMinutes: 1260,
  daysPerTray: 14,
  effectiveAt: 300,
  id: 3,
  totalTrays: 52,
  treatmentId: 1,
};

describe('createTreatmentPlanHistoryReadModel', () => {
  it('identifies only the newest version as current', () => {
    const versions = [
      NEWEST_VERSION,
      { ...NEWEST_VERSION, effectiveAt: 200, id: 2 },
      { ...NEWEST_VERSION, effectiveAt: 100, id: 1 },
    ];

    const history = createTreatmentPlanHistoryReadModel(versions);

    expect(history.map((version) => ({ id: version.id, isCurrent: version.isCurrent }))).toEqual([
      { id: 3, isCurrent: true },
      { id: 2, isCurrent: false },
      { id: 1, isCurrent: false },
    ]);
    expect(versions[0]).toEqual(NEWEST_VERSION);
  });

  it('handles an empty history', () => {
    expect(createTreatmentPlanHistoryReadModel([])).toEqual([]);
  });
});

describe('formatPrescribedMinutes', () => {
  it('formats whole hours, mixed hours and minutes, and minute-only values', () => {
    expect(formatPrescribedMinutes(0)).toBe('0m');
    expect(formatPrescribedMinutes(30)).toBe('30m');
    expect(formatPrescribedMinutes(60)).toBe('1h');
    expect(formatPrescribedMinutes(90)).toBe('1h 30m');
    expect(formatPrescribedMinutes(1320)).toBe('22h');
    expect(formatPrescribedMinutes(1350)).toBe('22h 30m');
    expect(formatPrescribedMinutes(1440)).toBe('24h');
  });
});
