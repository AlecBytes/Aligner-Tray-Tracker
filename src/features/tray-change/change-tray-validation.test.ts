import {
  getNextTrayNumber,
  getPreviousTrayNumber,
  validateTrayNumber,
} from '@/features/tray-change/change-tray-validation';

describe('tray change selection', () => {
  it('selects the next tray within the treatment plan', () => {
    expect(getNextTrayNumber(9, 48)).toBe(10);
    expect(getNextTrayNumber(48, 48)).toBeNull();
  });

  it('selects the previous tray above tray one', () => {
    expect(getPreviousTrayNumber(9)).toBe(8);
    expect(getPreviousTrayNumber(1)).toBeNull();
  });

  it('parses a manually entered tray number', () => {
    expect(validateTrayNumber(' 12 ', 48, 9)).toEqual({ data: 12, success: true });
  });

  it('rejects the tray that is already active', () => {
    expect(validateTrayNumber('9', 48, 9)).toEqual({
      error: 'Tray 9 is already active.',
      success: false,
    });
  });

  it.each(['', '0', '49', '2.5', '-1'])('rejects invalid tray number %p', (value) => {
    expect(validateTrayNumber(value, 48)).toEqual({
      error: 'Enter a whole number from 1 to 48.',
      success: false,
    });
  });
});
