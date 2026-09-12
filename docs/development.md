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

Use `npm test` to run Jest. Its launcher sets `America/New_York` before Jest
starts so the daylight-saving fixtures behave consistently on local machines
and UTC build servers. This affects tests only, not the app's local timezone.

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

## Build and release to production

Version 1.0 excludes paid features, Cloud Backup, Apple Watch, and Siri/App
Shortcuts. Production omits the Watch target and Siri declaration plugins and
disables companion activation in the native module. Phone notifications retain
their existing native implementation. Development and preview retain these
future features for testing.

A production EAS build creates the signed App Store binary. It does not publish
the app or submit it for App Review. The resulting build must first be uploaded
to App Store Connect, tested through TestFlight, and then selected for App
Review.

Before building a release candidate:

1. Complete the applicable items in the
   [App Store release plan](app-store-release-plan.md), including the explicit
   feature boundary and physical-device verification.
2. Use a clean, committed revision so the tested source matches the submitted
   binary.
3. Verify the production profile explicitly sets paid access and Cloud Backup to
   `disabled`. Version 1.0 is a free, local-only release and requires no
   RevenueCat or Supabase production variables.
4. Confirm that the Apple Developer account, distribution certificate,
   provisioning profile, App Store Connect app, and bundle identifier
   `com.alecsbytes.alignertraytracker` are configured. Use
   `eas credentials --platform ios` when credentials need to be created or
   updated.

### Preferred: validated production workflow

Run the checked-in EAS workflow:

```sh
eas workflow:run .eas/workflows/create-production-builds.yml
```

The workflow installs locked dependencies, checks Expo package compatibility,
runs Expo Doctor and `npm run validate`, and only then builds iOS with the
`production` profile. It creates the production build but does not submit it to
App Store Connect.

### Manual production build

To build directly without the workflow:

```sh
npm ci
npx expo install --check
npx expo-doctor
npm run validate
eas build --platform ios --profile production
```

The explicit profile is intentional even though EAS defaults to `production`.
The profile uses remote app versioning and automatically increments the build
number. A production iOS build cannot be installed directly from an EAS link;
distribute it through App Store Connect and TestFlight.

For version 1.0, confirm the resolved production configuration includes:

```text
APP_VARIANT=production
EXPO_PUBLIC_APP_VARIANT=production
EXPO_PUBLIC_CLOUD_BACKUP_MODE=disabled
EXPO_PUBLIC_PAID_ACCESS_MODE=disabled
EXPO_PUBLIC_SUPPORT_MODE=disabled
```

Do not add RevenueCat or Supabase production variables for this release. Paid
access and cloud code remain in the repository for future work, while production
menus, routes, and cloud initialization are disabled.

### Upload to TestFlight

After the production build succeeds, upload the selected build to App Store
Connect:

```sh
eas submit --platform ios --profile production
```

The current `submit.production` profile is empty, so EAS may prompt for the
build and App Store Connect details. Configure its `ascAppId` and submission
credentials before relying on unattended submission.

EAS Submit uploads the binary; it does not submit the app for public App Store
review. Wait for Apple to process the build, assign it to the appropriate
TestFlight testers, and run the release verification matrix against that exact
candidate.

#### Current release checkpoint — September 12, 2026

The production candidate has completed processing and has been installed on a
physical iPhone through an internal TestFlight group. Continue testing that
exact build before public release. Internal TestFlight availability is separate
from public App Store review and does not release the app to customers.

### Submit for App Review

In App Store Connect:

1. Complete the app metadata, screenshots, privacy disclosures, pricing, and
   review information.
2. Select the verified production build for the App Store version.
3. Attach any required in-app purchases and provide reviewer instructions.
4. Submit the version for App Review.
5. After approval, release it according to the selected manual or automatic
   release setting.

See Expo's guides for
[production iOS builds](https://docs.expo.dev/tutorial/eas/ios-production-build/)
and [EAS Submit](https://docs.expo.dev/submit/ios/) for service-level details.

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
