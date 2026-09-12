describe('native release scope', () => {
  it.each(['production', 'development', 'preview'])('%s includes only its intended native entry points', (variant) => {
    const previous = process.env.APP_VARIANT;
    process.env.APP_VARIANT = variant;
    try {
      jest.isolateModules(() => {
        // Reload the dynamic config after selecting this build variant.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { default: configure } = require('../../app.config.js');
        const resolved = configure({ config: { plugins: ['expo-notifications'], ios: {} } });
        const plugins = resolved.plugins.map((plugin: string | [string, unknown]) =>
          Array.isArray(plugin) ? plugin[0] : plugin,
        );
        expect(plugins.includes('@bacons/apple-targets')).toBe(variant !== 'production');
        expect(plugins.includes('./modules/aligner-tracker-intents/app.plugin.js')).toBe(variant !== 'production');
        expect(resolved.ios.infoPlist.AlignerTrackerCompanionFeaturesEnabled).toBe(variant !== 'production');
        expect(plugins).toContain('expo-notifications');
      });
    } finally {
      if (previous === undefined) delete process.env.APP_VARIANT;
      else process.env.APP_VARIANT = previous;
    }
  });
});
