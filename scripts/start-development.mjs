process.env.APP_VARIANT = 'development';
process.argv.splice(2, 0, 'start');

await import('expo/bin/cli');
