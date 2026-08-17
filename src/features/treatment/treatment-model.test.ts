import { prescribedHoursToMinutes } from '@/features/treatment/treatment-model';

describe('prescribedHoursToMinutes', () => {
  it('converts whole and fractional hours to whole minutes', () => {
    expect(prescribedHoursToMinutes(22)).toBe(1320);
    expect(prescribedHoursToMinutes(22.5)).toBe(1350);
    expect(prescribedHoursToMinutes(24)).toBe(1440);
  });
});
