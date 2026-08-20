const isDevelopment = process.env.APP_VARIANT === 'development';

export default ({ config }) => ({
  ...config,
  name: isDevelopment ? 'Aligner Tracker (Dev)' : 'Aligner Tracker',
  ios: {
    ...config.ios,
    bundleIdentifier: isDevelopment
      ? 'com.alecsbytes.alignertraytracker.dev'
      : 'com.alecsbytes.alignertraytracker',
  },
});
