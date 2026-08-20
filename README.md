# Aligner Tracker

Aligner Tracker is a performance-first, utility-first app for tracking orthodontic aligner wear. It keeps treatment plans, tray history, and timestamped IN/OUT events on the device so normal tracking remains fast and works without a network connection.

## Architecture

The current app is a local-first React Native application built with Expo SDK 57, TypeScript, Expo Router, and SQLite. SQLite is the on-device source of truth; elapsed wear time and statistics are derived from persisted timestamps rather than a continuously stored timer. Local reminders use Expo Notifications.

Authentication, cloud backup/synchronization, and the planned ASP.NET Core/.NET backend are intentionally deferred and are not present in this repository.

## Documentation

- [`docs/mvp-plan.md`](docs/mvp-plan.md) — product goals and overall architecture direction
- [`docs/planner-context.md`](docs/planner-context.md) — current cross-feature decisions and priorities
- [`docs/performance.md`](docs/performance.md) — performance budgets and measurement plan
- [`docs/features/`](docs/features/) — implemented feature behavior and feature-specific requirements

## Current status

The repository contains the on-device treatment setup and tracker, tray changes, versioned treatment-plan editing and history, IN/OUT corrections, local statistics, notification settings/reminders, and help screens. A support-purchase screen is available only as a development preview backed by a mock service.

The Account screen is informational: sign-in, cloud backup/restore, synchronization, and backend services have not been implemented and remain intentionally deferred while the local experience is developed.

## Prerequisites

- Node.js 22.13.0, as specified by `.nvmrc`
- npm

With `nvm`, install and select the required Node version:

```sh
nvm install
nvm use
```

## Install and run

```sh
npm install
npx expo start
```

`npx expo start` is the canonical development command. The following package scripts are also available:

| Command | Purpose |
| --- | --- |
| `npm run android` | Start Expo and open Android |
| `npm run ios` | Start Expo and open iOS |
| `npm run web` | Start Expo for web |
| `npm run test` | Run Jest tests |
| `npm run lint` | Run Expo ESLint checks |
| `npm run typecheck` | Run TypeScript without emitting files |
| `npm run validate` | Run typecheck, lint, and tests |

## iOS device testing

The EAS profiles in [`eas.json`](eas.json) support two physical-iPhone workflows.

### Test current code with the development build

Use this for normal development and quick feature testing.

1. Make sure the Aligner Tracker development build is installed on the iPhone.
2. From the repository root, start Metro:

```sh
npx expo start
```

3. Open the development build on the iPhone and connect it to Metro.
4. Test and iterate normally with Fast Refresh.

A new development build is generally only needed when native dependencies or native app configuration change:

```sh
eas build --platform ios --profile development
```

Install the resulting build on the registered iPhone, then continue using `npx expo start` for development.

### Install a standalone preview build

Use this when a version is ready for normal day-to-day testing without Metro or the development computer.

1. Test the changes with the development build first.
2. Commit the version you want to test.
3. Create the preview build:

```sh
eas build --platform ios --profile preview
```

4. Open the EAS build/install link on the registered iPhone and install the new build.
5. Launch Aligner Tracker normally.

The preview build is self-contained and does **not** require `npx expo start` or a connection to the development computer.development-client tools.
