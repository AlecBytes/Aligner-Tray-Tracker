import { resolveSupportContact } from './app-config';

describe('resolveSupportContact', () => {
  it('normalizes a configured support address', () => {
    expect(resolveSupportContact('  help@aligner.example  ')).toBe('help@aligner.example');
  });

  it.each([undefined, null, '', '   ', 'support@example.com', 'SUPPORT@EXAMPLE.COM'])(
    'treats %p as unconfigured',
    (value) => {
      expect(resolveSupportContact(value)).toBeNull();
    },
  );
});
