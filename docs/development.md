# Development guide

This guide contains the local setup, device testing, build, and integration
notes for Aligner Tracker. For the product overview, see the repository
[README](../README.md).

## Prerequisites

- Node.js 22.13.0, as specified by [`.nvmrc`](../.nvmrc)
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

`npm start` is the canonical development command. It sets the development app
variant in a cross-platform way and starts Metro.

| Command | Purpose |
| --- | --- |
| `npm start` | Start Metro using the development app variant |
| `npm run ios` | Start Expo and open iOS |
| `npm run android` | Start Expo and open Android |
| `npm run web` | Start Expo for web |
| `npm run test` | Run Jest tests |
| `npm run lint` | Run Expo ESLint checks |
| `npm run typecheck` | Run TypeScript without emitting files |
| `npm run check:ios-ui-purity` | Validate that app-owned iOS UI uses Expo UI SwiftUI |
| `npm run validate` | Run typecheck, lint, iOS UI purity, and tests |

Android and web commands remain available for development tooling, but Android
and web are not currently supported product targets.

## iOS build variants

The `development` and `preview` profiles in [`eas.json`](../eas.json) support two
physical-iPhone workflows.

| Profile | Installed name | Bundle identifier | Requires Metro |
| --- | --- | --- | --- |
| Development | Aligner Tracker (Dev) | `com.alecsbytes.alignertraytracker.dev` | Yes |
| Preview | Aligner Tracker | `com.alecsbytes.alignertraytracker` | No |

The builds can remain installed on the same device. iOS treats them as separate
apps, so each build has its own local SQLite database. Treatment data entered in
one does not appear in the other.

### Test current code with a development build

Use this workflow for normal development and Fast Refresh:

1. Make sure **Aligner Tracker (Dev)** is installed on the iPhone.
2. Start Metro from the repository root:

   ```sh
   npm start
   ```

3. Open **Aligner Tracker (Dev)** and connect it to Metro.

A new development build is generally required only after changing native
dependencies or native app configuration:

```sh
eas build --platform ios --profile development
```

Open the resulting EAS install link on the registered iPhone. After installing
the build, use `npm start` for subsequent JavaScript and TypeScript changes.

### Connect an iPhone from WSL

If the app reports **“Failed to load app. The request timed out”**, the iPhone
may be unable to reach Metro over the local network. Stop the existing Metro
server with **Ctrl+C**, then run:

```sh
nvm use
npm start -- --dev-client --tunnel
```

Accept the `@expo/ngrok` installation prompt if one appears. Wait for the tunnel
to be ready, then scan the new QR code with the iPhone camera. Keep the terminal
running while testing; an older launcher entry may point to an unreachable
server address.

The tunnel requires internet access and may load more slowly than a direct LAN
connection. See [Expo's development-build tunnel documentation](https://docs.expo.dev/develop/development-builds/development-workflows/#tunnel-urls).

### Install a standalone preview build

Use a preview build for day-to-day testing without Metro or the development
computer:

1. Test the changes with the development build.
2. Commit the version to test.
3. Create the preview build:

   ```sh
   eas build --platform ios --profile preview
   ```

4. Open the EAS install link on the registered iPhone and install the build.
5. Launch **Aligner Tracker** normally.

## Start Expo with MCP capabilities

```sh
EXPO_UNSTABLE_MCP_SERVER=1 npx expo start
```

## Paid-access development

The commercial and entitlement contract is defined in
[Paid Access](features/paid-access.md), and theme behavior is defined in
[Themes](features/themes.md). The application reads product identifiers and
localized prices from RevenueCat rather than hard-coding them.

Paid access uses these public build variables:

| Variable | Values or purpose |
| --- | --- |
| `EXPO_PUBLIC_PAID_ACCESS_MODE` | `disabled`, `mock`, `test-store`, or `apple` |
| `EXPO_PUBLIC_APP_VARIANT` | Runtime-visible `development`, `preview`, or `production` safety check; EAS profiles set this with `APP_VARIANT` |
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | Test Store `test_...` or Apple `appl_...` public SDK key matching the selected mode |
| `EXPO_PUBLIC_TERMS_URL` | Public Terms of Use URL |
| `EXPO_PUBLIC_PRIVACY_URL` | Public Privacy Policy URL |

`npm start` and the EAS development profile default to Test Store with
`EXPO_PUBLIC_PAID_ACCESS_MODE=test-store` and public SDK key
`EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=test_biVNuNEpgMcBaWxsUrKvilcdDvi`.
Local startup permits explicit shell environment overrides. Use the following
only for deterministic mock testing:

```sh
EXPO_PUBLIC_PAID_ACCESS_MODE=mock npm start
```

Preview and production select Apple. Supply their matching Apple public key and
policy URLs through EAS environment configuration. Production rejects mock,
Test Store, and mismatched key prefixes. Missing or invalid purchase
configuration makes purchase options unavailable without affecting tracking.

Because `react-native-purchases` is a native dependency, rebuild the development
client after installing or changing it:

```sh
eas build --platform ios --profile development
```

Use the development bundle identifier only with a separately configured
RevenueCat/Apple app. Apple sandbox verification for the production catalog
should use a preview or TestFlight build with
`com.alecsbytes.alignertraytracker`. Never put RevenueCat secret keys or Apple
credentials in this repository.

### Test Store catalog

As verified on September 5, 2026, the configured public Test Store SDK key
exposes offering `default`, containing:

- `$rc_monthly` mapped to `monthly`
- `$rc_annual` mapped to `yearly`
- `$rc_lifetime` mapped to `lifetime`

Test Store mode explicitly selects `default`; Apple mode requires `premium`.
Both environments require entitlement `aligner_tray_tracker_pro`. The Test
Store name is a development catalog exception, not a fallback to whichever
offering is current.

To exercise the Test Store catalog:

```sh
npm start -- --clear
```

Reload the iOS development client, open **Menu → Themes**, tap a locked color,
and complete a Test Store purchase. Confirm that the selected theme applies,
then test the other colors and **Restore Purchases**.

For offline theme UI testing, run:

```sh
EXPO_PUBLIC_PAID_ACCESS_MODE=mock npm start -- --clear
```

Mock access resets when the JavaScript session restarts and does not verify
billing. The catalog read verifies product availability only. Product-to-
entitlement attachment and native purchase/restore still require device
verification; Apple setup and real sandbox verification remain release work.
