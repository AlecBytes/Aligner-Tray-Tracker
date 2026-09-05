const isDevelopment = process.env.APP_VARIANT === 'development';
const appleTeamId = process.env.APPLE_TEAM_ID;
const paidAccessMode = process.env.EXPO_PUBLIC_PAID_ACCESS_MODE;

if (!isDevelopment && process.env.APP_VARIANT === 'production' && paidAccessMode !== 'apple') {
  throw new Error('Production builds must use EXPO_PUBLIC_PAID_ACCESS_MODE=apple.');
}

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
