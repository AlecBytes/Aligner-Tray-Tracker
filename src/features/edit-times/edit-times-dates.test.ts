import {
  addLocalDays,
  buildTreatmentDateHistory,
  formatLocalDateKey,
  parseLocalDateTime,
} from '@/features/edit-times/edit-times-dates';

describe('Edit In/Out Times date helpers', () => {
  it('groups seven-day treatment weeks from the treatment start date', () => {
    const treatmentStart = new Date(2026, 6, 27, 9).getTime();
    const now = new Date(2026, 7, 16, 12).getTime();
    const history = buildTreatmentDateHistory(treatmentStart, now);

    expect(history.currentWeekDays.map((day) => day.dateKey)).toEqual([
      '2026-08-16',
      '2026-08-15',
      '2026-08-14',
      '2026-08-13',
      '2026-08-12',
      '2026-08-11',
      '2026-08-10',
    ]);
    expect(history.previousWeeks.map((week) => week.weekNumber)).toEqual([2, 1]);
  });

  it('parses an editable local date and time without converting it to UTC', () => {
    const timestamp = parseLocalDateTime('2026-08-16', '08:02:15');

    expect(timestamp).not.toBeNull();
    expect(formatLocalDateKey(timestamp!)).toBe('2026-08-16');
    expect(new Date(timestamp!).getHours()).toBe(8);
  });

  it('advances calendar days safely for day query boundaries', () => {
    const day = new Date(2026, 2, 8).getTime();
    const nextDay = addLocalDays(day, 1);

    expect(formatLocalDateKey(nextDay)).toBe('2026-03-09');
    expect(new Date(nextDay).getHours()).toBe(0);
  });
});

