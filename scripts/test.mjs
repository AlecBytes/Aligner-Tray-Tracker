// Set the fixture timezone before Jest creates its workers and VM environments.
// Changing process.env.TZ inside a test does not reliably change Date's timezone.
process.env.TZ = 'America/New_York';

await import('jest/bin/jest');
