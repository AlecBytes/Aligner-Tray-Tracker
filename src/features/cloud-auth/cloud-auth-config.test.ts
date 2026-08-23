import {
  getCloudAuthConfiguration,
  resolveCloudAuthConfiguration,
} from '@/features/cloud-auth/cloud-auth-config';

describe('cloud auth configuration', () => {
  it('accepts an HTTPS URL and publishable key', () => {
    expect(
      resolveCloudAuthConfiguration({
        url: 'https://project.supabase.co',
        publishableKey: 'sb_publishable_public-value',
      }),
    ).toEqual({
      status: 'configured',
      url: 'https://project.supabase.co',
      publishableKey: 'sb_publishable_public-value',
    });
  });

  it('accepts the existing development environment key name', () => {
    const previousUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const previousPublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const previousKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
    delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    process.env.EXPO_PUBLIC_SUPABASE_KEY = 'sb_publishable_public-value';

    expect(getCloudAuthConfiguration()).toMatchObject({ status: 'configured' });

    if (previousUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    else process.env.EXPO_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousPublishableKey === undefined) {
      delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    } else {
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = previousPublishableKey;
    }
    if (previousKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_KEY;
    else process.env.EXPO_PUBLIC_SUPABASE_KEY = previousKey;
  });

  it.each([
    [{}, 'missing'],
    [{ url: 'not a URL', publishableKey: 'sb_publishable_value' }, 'malformed URL'],
    [
      { url: 'http://project.supabase.co', publishableKey: 'sb_publishable_value' },
      'non-HTTPS URL',
    ],
    [
      { url: 'https://project.supabase.co', publishableKey: 'sb_secret_private' },
      'secret key',
    ],
    [
      { url: 'https://project.supabase.co', publishableKey: 'service_role' },
      'privileged key',
    ],
    [
      { url: 'https://project.supabase.co', publishableKey: 'legacy-anon-key' },
      'legacy key',
    ],
  ])('rejects %s configuration without exposing it (%s)', (input, _description) => {
    const result = resolveCloudAuthConfiguration(input);

    expect(result).toEqual({
      status: 'unavailable',
      message: 'Cloud Backup is not configured for this build.',
    });
    for (const value of Object.values(input)) {
      expect(JSON.stringify(result)).not.toContain(value);
    }
  });
});
