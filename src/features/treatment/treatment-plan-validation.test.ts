import { validateTreatmentPlan } from '@/features/treatment/treatment-plan-validation';

describe('validateTreatmentPlan', () => {
  it('parses valid current-plan values', () => {
    expect(
      validateTreatmentPlan({
        daysPerTray: '10',
        prescribedHoursPerDay: '22.5',
        totalTrays: '52',
      }),
    ).toEqual({
      data: { daysPerTray: 10, prescribedHoursPerDay: 22.5, totalTrays: 52 },
      success: true,
    });
  });

  it('reuses the setup limits for tray counts, days, and prescribed hours', () => {
    expect(
      validateTreatmentPlan({
        daysPerTray: '1.5',
        prescribedHoursPerDay: '24.1',
        totalTrays: '0',
      }),
    ).toEqual({
      errors: {
        daysPerTray: 'Enter a positive whole number.',
        prescribedHoursPerDay: 'Enter a number greater than 0 and no greater than 24.',
        totalTrays: 'Enter a positive whole number.',
      },
      success: false,
    });
  });

  it('does not allow a plan to exclude the currently active tray', () => {
    expect(
      validateTreatmentPlan(
        {
          daysPerTray: '7',
          prescribedHoursPerDay: '22',
          totalTrays: '8',
        },
        9,
      ),
    ).toEqual({
      errors: {
        totalTrays: 'Total trays cannot be less than the current tray (9).',
      },
      success: false,
    });
  });
});
