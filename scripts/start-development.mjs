process.env.APP_VARIANT = 'development';
process.env.EXPO_PUBLIC_APP_VARIANT = 'development';
process.env.EXPO_PUBLIC_SUPPORT_MODE ??= 'mock';
process.env.EXPO_PUBLIC_PAID_ACCESS_MODE ??= 'test-store';
process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ??= 'test_biVNuNEpgMcBaWxsUrKvilcdDvi';
process.argv.splice(2, 0, 'start');

await import('expo/bin/cli');
