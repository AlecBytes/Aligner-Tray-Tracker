const isDevelopment = process.env.APP_VARIANT === 'development';

export default ({ config }) => ({
  ...config,
  name: isDevelopment ? 'Aligner Tracker (Dev)' : 'Aligner Tracker',
  plugins: [
    ...(config.plugins ?? []),
    './modules/aligner-tracker-intents/app.plugin.js',
  ],
  ios: {
    ...config.ios,
    bundleIdentifier: isDevelopment
      ? 'com.alecsbytes.alignertraytracker.dev'
      : 'com.alecsbytes.alignertraytracker',
    deploymentTarget: '16.4',
  },
});
