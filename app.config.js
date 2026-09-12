const isDevelopment = process.env.APP_VARIANT === 'development';
const companionFeaturesEnabled = process.env.APP_VARIANT !== 'production';
const appleTeamId = process.env.APPLE_TEAM_ID;
const paidAccessMode = process.env.EXPO_PUBLIC_PAID_ACCESS_MODE;
const cloudBackupEnabled = process.env.EXPO_PUBLIC_CLOUD_BACKUP_MODE !== 'disabled';

if (!isDevelopment && process.env.APP_VARIANT === 'production' && paidAccessMode && paidAccessMode !== 'apple' && paidAccessMode !== 'disabled') {
  throw new Error('Production Apple premium builds must use EXPO_PUBLIC_PAID_ACCESS_MODE=apple; free-first production builds should leave the mode unset or set it to disabled.');
}

export default ({ config }) => ({
  ...config,
  name: isDevelopment ? 'Aligner Tracker (Dev)' : 'Aligner Tracker',
  plugins: [
    ...(config.plugins ?? []).filter((plugin) => {
      const pluginName = Array.isArray(plugin) ? plugin[0] : plugin;
      return cloudBackupEnabled || pluginName !== 'expo-apple-authentication';
    }),
    ...(companionFeaturesEnabled ? ['./modules/aligner-tracker-intents/app.plugin.js', [
      '@bacons/apple-targets',
      {
        ...(appleTeamId ? { appleTeamId } : {}),
      },
    ]] : []),
  ],
  ios: {
    ...config.ios,
    ...(appleTeamId ? { appleTeamId } : {}),
    bundleIdentifier: isDevelopment
      ? 'com.alecsbytes.alignertraytracker.dev'
      : 'com.alecsbytes.alignertraytracker',
    deploymentTarget: '16.4',
    usesAppleSignIn: cloudBackupEnabled,
    infoPlist: {
      ...config.ios?.infoPlist,
      AlignerTrackerCompanionFeaturesEnabled: companionFeaturesEnabled,
    },
  },
});
