process.env.APP_VARIANT = 'development';
process.env.EXPO_PUBLIC_SUPPORT_MODE ??= 'mock';
process.argv.splice(2, 0, 'start');

await import('expo/bin/cli');
