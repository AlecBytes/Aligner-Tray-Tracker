# Build 4 tracker state regression

Reported September 12, 2026: OUT → IN → browse Menu without saving edits → return to
OUT → tap IN → update error. Source: `feedback.json` and `screenshot_01.jpg` in this
directory. The original device failure has not been reproduced under instrumentation.

## Implemented

- Native store and native fixtures use ExpoSQLite's bundled `exsqlite3_*` functions;
  the intents pod depends on ExpoSQLite instead of linking system SQLite directly.
  The database path, schema version, transaction policy, and existing history are unchanged.
- One iOS refresh coordinator rejects obsolete reads, ignores results after blur/unmount,
  and coalesces refresh requests during mutations into a post-mutation readback.
- Already-in-state is a successful no-op. Missing treatment has a distinct response.
  Accepted snapshots validate session undo/redo state.
- Failed readbacks offer Retry and indicate potentially outdated state. A committed save
  with a failed refresh is distinguished from a failed write and from a reminder failure.

The mixed SQLite implementations and read-ordering issues are concrete code findings,
but their contribution to this specific device incident remains unconfirmed.

## Automated verification — September 12, 2026

- `npm run validate`: passed, 66 suites / 415 tests, TypeScript, ESLint, and iOS UI purity.
  Notification parity tests required execution outside the restricted sandbox.
- `npx expo install --check`: dependencies up to date.
- `npx expo-doctor`: 21/21 checks passed.
- Added 12 iOS screen regression tests and four refresh-coordinator tests.
- Added native XCTest coverage for committed-state visibility across open Expo SQLite
  connections and concurrent idempotent mutations. These XCTest tests have not run here.

## Outstanding release verification

This environment is Linux and has no Xcode or connected iPhone. Automatic approval review
blocked the remote production build because it would upload private source to EAS and
increment the remote build number. No replacement build number has been assigned by this work.

1. Approve and run `eas build --platform ios --profile production --non-interactive`.
   Confirm the ExpoSQLite dependency and native store compile in the signed archive.
2. On macOS, run the intents pod's `Tests` test spec through XCTest, including the two
   new connection/concurrency tests. Record the Xcode version and results here.
3. Submit the selected successful build to TestFlight and install it over build 4 without
   uninstalling or resetting data. Record the replacement build number and source revision.
4. Repeat OUT → IN → browse Menu → return. Verify IN remains displayed, the next tap
   records OUT exactly once, and timestamps/daily totals match event history.
5. Repeat with background/foreground, force-close/relaunch, rapid taps, undo/redo, and
   reminder delivery/cancellation. Verify existing treatment history remains intact.

Do not mark the device incident resolved until the native tests and physical-device
upgrade/navigation checks pass. Record the device, OS, date, and results here.
