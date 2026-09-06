# Aligner Tracker

Aligner Tracker is a performance-first, utility-first app for tracking orthodontic aligner wear. It keeps treatment plans, tray history, and timestamped IN/OUT events on the device so normal tracking remains fast and works without a network connection.

## Architecture

The current app is a local-first, iOS-only React Native application built with Expo SDK 57, TypeScript, Expo Router, and SQLite. SQLite is the on-device source of truth; elapsed wear time and statistics are derived from persisted timestamps rather than a continuously stored timer. Local reminders use Expo Notifications. Android and web are not currently supported product targets.

The optional cloud foundation uses Supabase with Sign in with Apple. Phase 1 iOS authentication and Phase 2C manual **Back Up Now** are implemented without changing the local-first source of truth. Automatic backup, restore, retention, cloud-account deletion, and multi-device sync remain future work.

## Documentation

- [`docs/mvp-plan.md`](docs/mvp-plan.md) — product goals and overall architecture direction
- [`docs/planner-context.md`](docs/planner-context.md) — current cross-feature decisions and priorities
- [`docs/performance.md`](docs/performance.md) — performance budgets and measurement plan
- [`docs/expo-audit-follow-ups.md`](docs/expo-audit-follow-ups.md) — open items from the Expo best-practices audit
- [`docs/features/`](docs/features/) — feature-specific behavior, requirements, and future decisions
- [`docs/features/cloud-backup-restore.md`](docs/features/cloud-backup-restore.md) — implemented iOS authentication and manual backup phases, plus the remaining Backup & Restore roadmap
- [`docs/features/cloud-sync-future.md`](docs/features/cloud-sync-future.md) — constraints and unresolved decisions for future sync

## Current status

The repository contains the on-device treatment setup and tracker, tray changes, versioned treatment-plan editing and history, IN/OUT corrections, local statistics, notification settings/reminders, and help screens. A support-purchase screen is available only as a development preview backed by a mock service.

On iOS, Cloud Backup supports Sign in with Apple, securely persisted sessions, local sign-out, and a manual **Back Up Now** flow through Supabase. The manual flow creates deterministic snapshots, skips unchanged completed content, and reports retryable failures. Automatic backup, restore, retention, cloud-account deletion, and multi-device synchronization are not implemented.

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
npm start
```

`npm start` is the canonical development command. It sets the development app variant in a cross-platform way and starts Metro. The following package scripts are also available:

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

The existing `development` and `preview` profiles in [`eas.json`](eas.json) support two physical-iPhone workflows. The development build installs as **Aligner Tracker (Dev)** with bundle identifier `com.alecsbytes.alignertraytracker.dev`. Preview and production builds install as **Aligner Tracker** with bundle identifier `com.alecsbytes.alignertraytracker`.

### Test current code with the development build

Use this for normal development and quick feature testing.

1. Make sure **Aligner Tracker (Dev)** is installed on the iPhone.
2. From the repository root, start Metro:

```sh
npm start
```

3. Open **Aligner Tracker (Dev)** on the iPhone and connect it to Metro.
4. Test and iterate normally with Fast Refresh.

A new development build is generally only needed when native dependencies or native app configuration change:

```sh
eas build --platform ios --profile development
```

Open the resulting EAS build/install link on the registered iPhone and install **Aligner Tracker (Dev)**. Then use `npm start` whenever you want to run that build with Metro.

#### Connecting an iPhone from WSL

If the app shows **“Failed to load app. The request timed out”**, the iPhone may be unable to reach Metro over the local network. A development build needs the running development server to load the app.

Stop any existing Metro server with **Ctrl+C**, then run from the repository root:

```sh
nvm use
npm start -- --dev-client --tunnel
```

Accept the `@expo/ngrok` installation prompt if one appears. Wait for the tunnel to be ready, then scan the **new QR code** with the iPhone camera to open **Aligner Tracker (Dev)**. Keep the terminal running while testing; an older launcher entry may point to an unreachable server address.

This tunnel workflow has been verified with WSL and a physical iPhone. It requires internet access and can load more slowly than a direct LAN connection. See [Expo's development-build tunnel documentation](https://docs.expo.dev/develop/development-builds/development-workflows/#tunnel-urls).

### Install a standalone preview build

Use this when a version is ready for normal day-to-day testing without Metro or the development computer.

1. Test the changes with the development build first.
2. Commit the version you want to test.
3. Create the preview build:

```sh
eas build --platform ios --profile preview
```

4. Open the EAS build/install link on the registered iPhone and install the new build.
5. Launch **Aligner Tracker** normally.

The preview build is self-contained and does **not** require Metro or a connection to the development computer.

The development and preview builds have different iOS bundle identifiers, so they can remain installed on the same device at the same time. iOS treats them as separate apps, which also means each build has its own local SQLite database. Treatment data entered in one build does not appear in the other.

## Start the dev server with MCP capabilities

```sh
EXPO_UNSTABLE_MCP_SERVER=1 npx expo start
```

## Paid access and Themes Phase 1

Commercial terms and access behavior are specified in [Paid Access](docs/features/paid-access.md); visual behavior and staged integration are in [Themes](docs/features/themes.md). Launch options are $0.99 USD/month, $7.99 USD/year, and $49.99 USD lifetime for all current and future paid features. Core utility stays free; tips grant no access; no trials or introductory discounts.

The local theme registry, native iOS theme and purchase screens, and RevenueCat SDK boundary are implemented. Dashboard configuration and Apple sandbox evidence remain release work in #39–#43. Configure monthly/annual subscriptions and a lifetime non-consumable against RevenueCat entitlement `aligner_tray_tracker_pro` and explicit offering `premium`. The application reads product identifiers and localized prices from that offering.

Paid access uses these public build variables:

| Variable | Values / purpose |
| --- | --- |
| `EXPO_PUBLIC_PAID_ACCESS_MODE` | `disabled`, `mock`, `test-store`, or `apple` |
| `EXPO_PUBLIC_APP_VARIANT` | Runtime-visible `development`, `preview`, or `production` safety check; EAS profiles set this with `APP_VARIANT` |
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | Test Store `test_…` or Apple `appl_…` public SDK key matching the selected mode |
| `EXPO_PUBLIC_TERMS_URL` | Final public Terms of Use URL |
| `EXPO_PUBLIC_PRIVACY_URL` | Final public Privacy Policy URL |

`npm start` and the EAS development profile default to Test Store with `EXPO_PUBLIC_PAID_ACCESS_MODE=test-store` and public SDK key `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=test_biVNuNEpgMcBaWxsUrKvilcdDvi`. Local startup permits explicit shell environment overrides; use `EXPO_PUBLIC_PAID_ACCESS_MODE=mock npm start` only for deterministic mock testing. Preview and production select Apple; supply their matching Apple public key and policy URLs through EAS environment configuration. Production rejects mock, Test Store, and mismatched key prefixes. Missing or invalid configuration makes purchase options unavailable without affecting tracking.

Because `react-native-purchases` is a native dependency, rebuild after installing or changing it:

```sh
eas build --platform ios --profile development
```

Use the development bundle ID only with a separately configured RevenueCat/Apple app. Apple sandbox verification for the production catalog should use a preview or TestFlight build with `com.alecsbytes.alignertraytracker`. Before release, record real monthly, annual, and lifetime purchase and restore results, including reinstall restoration with the same App Store account. Test Store and mock results must be identified separately and do not complete Apple verification. Never put RevenueCat secret keys or Apple credentials in this repository.
