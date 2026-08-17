# Aligner Tracker

A local-first Expo application for fast, reliable orthodontic aligner wear tracking.

## Development

Use Node.js 22.13 or newer, then install dependencies and start Expo:

```sh
npm install
npm start
```

Run all static checks and unit tests with:

```sh
npm run validate
```

SQLite is the on-device source of truth. The current foundation intentionally contains no backend,
authentication, cloud synchronization, analytics, or post-MVP features.

The Help screen support address is configured with `expo.extra.supportContact` in `app.json`.
