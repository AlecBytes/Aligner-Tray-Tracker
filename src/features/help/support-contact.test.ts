import { buildSupportEmailUrl, openSupportEmail } from './support-contact';

describe('support contact email', () => {
  it('builds a standard support email without prefilled content', () => {
    expect(buildSupportEmailUrl('help+app@example.com', 'standard')).toBe(
      'mailto:help%2Bapp%40example.com',
    );
  });

  it('builds a premium email with only the expected editable subject and message prompt', () => {
    const url = buildSupportEmailUrl('help@example.com', 'premium');

    expect(url).toBe(
      'mailto:help%40example.com?subject=Aligner%20Tracker%20Pro%20Support&body=How%20can%20I%20help%3F',
    );
    expect(url).not.toMatch(/version|device|identifier|history|diagnostic|token|log/i);
  });

  it('does not build an email when support is unconfigured', () => {
    expect(buildSupportEmailUrl(null, 'standard')).toBeNull();
    expect(buildSupportEmailUrl(null, 'premium')).toBeNull();
  });

  it('reports whether the email application opened', async () => {
    const openUrl = jest.fn().mockResolvedValue(undefined);
    const rejectUrl = jest.fn().mockRejectedValue(new Error('No email app'));

    await expect(
      openSupportEmail({ contact: 'help@example.com', intent: 'premium', openUrl }),
    ).resolves.toBe(true);
    expect(openUrl).toHaveBeenCalledWith(
      'mailto:help%40example.com?subject=Aligner%20Tracker%20Pro%20Support&body=How%20can%20I%20help%3F',
    );
    await expect(
      openSupportEmail({ contact: 'help@example.com', intent: 'standard', openUrl: rejectUrl }),
    ).resolves.toBe(false);
  });

  it('does not call the platform when support is unconfigured', async () => {
    const openUrl = jest.fn();

    await expect(openSupportEmail({ contact: null, intent: 'premium', openUrl })).resolves.toBe(
      false,
    );
    expect(openUrl).not.toHaveBeenCalled();
  });
});
