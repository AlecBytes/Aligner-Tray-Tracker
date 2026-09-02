const isDevelopment = process.env.APP_VARIANT === 'development';
const appleTeamId = process.env.APPLE_TEAM_ID;

export default ({ config }) => ({
  ...config,
  name: isDevelopment ? 'Aligner Tracker (Dev)' : 'Aligner Tracker',
  plugins: [
    ...(config.plugins ?? []),
    './modules/aligner-tracker-intents/app.plugin.js',
    [
      '@bacons/apple-targets',
      {
        ...(appleTeamId ? { appleTeamId } : {}),
      },
    ],
  ],
  ios: {
    ...config.ios,
    ...(appleTeamId ? { appleTeamId } : {}),
    bundleIdentifier: isDevelopment
      ? 'com.alecsbytes.alignertraytracker.dev'
      : 'com.alecsbytes.alignertraytracker',
    deploymentTarget: '16.4',
  },
});
