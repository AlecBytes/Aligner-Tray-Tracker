import { validateTreatmentSetup } from '@/features/treatment/treatment-setup-validation';

describe('validateTreatmentSetup', () => {
  it('parses a valid treatment setup', () => {
    expect(
      validateTreatmentSetup({
        daysPerTray: '7',
        prescribedHoursPerDay: '22.5',
        startingTrayNumber: '9',
        totalTrays: '48',
      }),
    ).toEqual({
      data: {
        daysPerTray: 7,
        prescribedHoursPerDay: 22.5,
        startingTrayNumber: 9,
        totalTrays: 48,
      },
      success: true,
    });
  });

  it('requires positive whole numbers for tray and day fields', () => {
    const result = validateTreatmentSetup({
      daysPerTray: '1.5',
      prescribedHoursPerDay: '22',
      startingTrayNumber: '-1',
      totalTrays: '0',
    });

    expect(result).toEqual({
      errors: {
        daysPerTray: 'Enter a positive whole number.',
        startingTrayNumber: 'Enter a positive whole number.',
        totalTrays: 'Enter a positive whole number.',
      },
      success: false,
    });
  });

  it('rejects a starting tray above the total tray count', () => {
    const result = validateTreatmentSetup({
      daysPerTray: '7',
      prescribedHoursPerDay: '22',
      startingTrayNumber: '49',
      totalTrays: '48',
    });

    expect(result).toEqual({
      errors: { startingTrayNumber: 'Starting tray cannot exceed total trays.' },
      success: false,
    });
  });

  it('accepts prescribed hours above zero through 24', () => {
    const halfHour = validateTreatmentSetup({
      daysPerTray: '7',
      prescribedHoursPerDay: '0.5',
      startingTrayNumber: '1',
      totalTrays: '48',
    });
    const fullDay = validateTreatmentSetup({
      daysPerTray: '7',
      prescribedHoursPerDay: '24',
      startingTrayNumber: '1',
      totalTrays: '48',
    });

    expect(halfHour.success).toBe(true);
    expect(fullDay.success).toBe(true);
  });

  it('rejects prescribed hours at or below zero and above 24', () => {
    for (const prescribedHoursPerDay of ['0', '-1', '24.1']) {
      const result = validateTreatmentSetup({
        daysPerTray: '7',
        prescribedHoursPerDay,
        startingTrayNumber: '1',
        totalTrays: '48',
      });

      expect(result).toEqual({
        errors: {
          prescribedHoursPerDay: 'Enter a number greater than 0 and no greater than 24.',
        },
        success: false,
      });
    }
  });
});
