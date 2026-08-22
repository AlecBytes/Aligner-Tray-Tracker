import { resolveSupportMode } from '@/config/support-config';

describe('resolveSupportMode', () => {
  it('enables the mock Support experience only for the mock mode', () => {
    expect(resolveSupportMode('mock')).toBe('mock');
  });

  it.each([undefined, 'disabled', 'production', 'MOCK', ''])('disables Support for %p', (mode) => {
    expect(resolveSupportMode(mode)).toBe('disabled');
  });
});
