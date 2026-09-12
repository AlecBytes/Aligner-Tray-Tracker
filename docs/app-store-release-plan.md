# App Store release plan

Reviewed September 11, 2026. Target: iPhone, iOS 16.4+, version 1.0.

## Current release status — September 12, 2026

- The production release candidate has been processed in App Store Connect and is available for internal TestFlight testing.
- Internal TestFlight installation was verified on a physical iPhone.
- This confirms the candidate can be distributed through TestFlight; it does not by itself publish the app to the App Store or complete public App Review.
- Remaining release work is physical-device verification, store metadata/privacy/support completion, and confirming the public App Store version's review and release status in App Store Connect.

The next evidence to record is the result of the device verification matrix against this exact TestFlight build. Keep the build number, device, iOS version, commit, and test date with that evidence.

## Repository work completed September 11, 2026

- Added an Expo Router root error boundary with app-owned SwiftUI recovery UI on iOS. It offers a retry, does not reset local data, and does not expose internal error details.
- Added focused coverage for the recovery state and retry action using a simulated migration/initialization error.
- Added a production EAS validation job with Node v22.13.0, locked dependency installation, Expo compatibility checks, Expo Doctor, and the repository validation suite. The production iOS build depends on that job and explicitly uses the production profile.
- Validated the workflow with Expo's live EAS workflow validator.
- Updated the Expo SDK 57 packages to Expo's current compatible patch versions and pinned Expo Doctor as a development dependency. Expo compatibility and all 21 Expo Doctor checks pass.
- Ran the full repository validation outside the restricted sandbox: 62 suites and 392 tests passed. This includes all 22 notification timezone/DST parity cases and the new recovery test. The earlier `ETIMEDOUT` result was caused by the restricted environment rejecting child-process execution (`EPERM`), not by a reminder-policy failure.

`npm audit` still reports one high-severity advisory through `@bacons/apple-targets` → `@bacons/xcode` → `@expo/plist@0.0.18` → `@xmldom/xmldom@0.7.13`. npm offers no compatible fix for the parent chain. This parser is build tooling rather than app runtime code, and production builds consume repository-controlled project files, which limits exposure. Track the upstream Apple-target toolchain and update when a compatible release is available; do not force an unverified transitive override into the native build. The audit also reports 18 moderate transitive advisories.

## Recommendation

The app has enough functionality for an initial release. Focus remaining work on reliability, support/privacy, and proving the signed build on physical devices. Additional tracker features are not the missing ingredient.

Confirmed 1.0 scope: ship the existing local tracker, corrections, treatment plans/history, statistics/graphs, notifications, Share Progress, and Help as a free, local-only iPhone app. Paid features, Cloud Backup, Apple Watch, and Siri/App Shortcuts are deferred to future updates and disabled in production.

The future commercial decision in [Paid Access](features/paid-access.md) remains unchanged, but it does not apply to version 1.0. Production configuration explicitly disables RevenueCat, paid-theme and Premium Support entry points, Cloud Backup entry points, direct paid/cloud routes, and cloud initialization. Development and preview builds retain those foundations for continued work.

## What exists, and what the review established

| Area | Evidence in the repository | Assessment |
|---|---|---|
| Local tracker | Setup, IN/OUT, tray changes, treatment versioning, corrections, statistics and SQLite migrations/repository tests | Substantially implemented; retain and harden |
| iOS presentation | SwiftUI screen implementations; dependency-aware UI purity guard | Guard passes; visual/accessibility testing still required |
| Notifications | Settings, native coordinator, shared Swift/TypeScript policy fixtures | Implemented; automated parity result and physical delivery need verification |
| Paid access | RevenueCat iOS adapter, access lifecycle tests, paywall, themes and Premium Support | Integration exists for future work; excluded from production 1.0 |
| Cloud | Apple sign-in, manual snapshots, empty-install restore | Partial future implementation; excluded from production 1.0 |
| Siri / Watch | Local Swift module, App Intents, XCTest source, Watch target and connectivity code | Real implementations, not just roadmap ideas; native build/device evidence still needed |
| Release configuration | Bundle ID, EAS project, production profile, remote build numbering and processed TestFlight candidate | Internal TestFlight installation verified on a physical iPhone; public release status and final device evidence remain |
| Recovery / automation | Root error boundary and validated EAS pre-build gate | Repository work complete; release-device verification remains |
| Support / policies | `support@alecbytes.com` in app config | Address is configured; delivery and public support/privacy pages still require verification |

Inspected product/feature documents, release configuration, route/provider wiring, relevant screens and test coverage. This is a repository readiness review, not a complete line-by-line security audit or a physical-device UX review. No Apple, EAS, RevenueCat or Supabase dashboard state was verified. Missing values in checked-in configuration may exist in hosted environments; do not assume they are absent remotely.

Validation on Node v22.13.0:

- TypeScript, ESLint and iOS UI purity pass.
- Jest passes: 63 suites and 396 tests.
- All 22 notification parity cases pass when child-process execution is permitted.
- Expo dependency compatibility and all 21 Expo Doctor checks pass.
- The EAS production workflow passes Expo's live schema validator.
- Native XCTest, archive/signing, device measurements, Apple sandbox transactions and Supabase policy tests were not run in this review.

The [Expo audit follow-ups](expo-audit-follow-ups.md) now records recovery and build gating as complete; physical-device performance evidence remains open. Its closing cloud paragraph is also updated to match the [cloud feature specification](features/cloud-backup-restore.md) and current empty-install restore implementation.

## Critical before every 1.0 release

### 1. Protect local data and recover from startup failures

- Verify the new root recovery boundary in a release-like iPhone build by simulating an initialization failure. Expo Router hides its splash when a route boundary catches an error; confirm the app-owned recovery state appears and retry remounts initialization without changing local data.
- Exercise initialization/migration failures, interrupted saves, duplicate taps and reset cancellation. Verify that failed writes preserve the previous valid state.
- Run upgrade tests against prior database versions with realistic history; verify native schema compatibility whenever Siri/native writes remain present.
- Keep all SQLite mutation work consistent with [the transaction policy](sqlite-transactions.md). Preserve exactly one active tray, alternating punches, historical plan versions and tray boundaries.

Done when: fresh install and upgrade work; failure recovery preserves records; no known data-loss, duplicate-transition or timeline-corruption defect remains.

### 2. Make the release validation gate reproducible

- Keep the production EAS validation dependency green. The workflow now uses the pinned Node version, `npm ci`, Expo compatibility checks, pinned Expo Doctor and `npm run validate` before building.
- Run the local module's native XCTest suite on macOS and verify clean generated iOS projects compile. Jest plugin tests do not compile Swift or prove App Intent discovery.
- Record commit, commands, environment and results with the release candidate. Ensure the candidate is built from that validated commit.

Done when: all applicable automated checks pass and a validation failure prevents the normal production workflow from building.

### 3. Finish support, privacy and release copy

- Verify that `support@alecbytes.com` is monitored and that standard email support and copy-address fallback work on-device.
- Publish a public support page and privacy policy. Add an easily accessible in-app privacy link in Help/settings, including for free users. Verify `EXPO_PUBLIC_PRIVACY_URL` and `EXPO_PUBLIC_TERMS_URL` in the actual candidate when paid access ships.
- Describe the actual shipped data flow: local treatment history, optional cloud uploads if included, RevenueCat purchase-related data, and user-initiated support/sharing. Do not equate local-first with collecting no data without reviewing SDK behavior.
- Complete App Store privacy disclosures using the shipping binary and enabled services; inspect the archive's privacy manifests and required-reason API declarations, including dependencies. [Apple privacy details](https://developer.apple.com/app-store/app-privacy-details/)
- Present the app as recording a user's prescribed treatment. Avoid claims that it diagnoses, guarantees results, or determines clinical treatment; explain that prescription changes come from the user's clinician. Review screenshots and Help for consistent behavior and limitations.
- Make Reset App copy accurate about local data, retained cloud backups if applicable, and purchases/subscriptions. A local reset is not account deletion or subscription cancellation.

Apple requires working, complete submissions and an accessible privacy policy. These are submission requirements, not optional polish. [App Review Guidelines, 2.1 and 5.1.1](https://developer.apple.com/app-store/review/guidelines/)

Done when: all links work on-device, support reaches a real inbox, disclosures match the build, and no production screen shows a configuration placeholder.

### 4. Prove daily use on physical iPhones

Use the production candidate through TestFlight, with an older/smaller supported iPhone and a current iPhone. Cover the minimum supported and current iOS versions where available; document coverage gaps.

| Scenario | Required result |
|---|---|
| Fresh install, notifications declined, airplane mode | Setup and all core actions remain usable without sign-in or purchases |
| IN/OUT, rapid taps, terminate/reopen, background overnight | Correct persisted state and timestamp-derived totals; no duplicate punches |
| Midnight, timezone travel, daylight-saving changes | Correct day history/totals and reminder rescheduling |
| Next/previous/repeated/final tray, plan changes | Preserved history and valid current state; no automatic physical tray advance |
| Edit/delete punch, add missing time, invalid boundaries | Valid corrections work; invalid sequences fail without partial writes |
| Notification permissions/settings changes | OUT reminders cancel on IN; tray reminders reconcile without duplicates |
| Overdue reminder horizon | Verify the documented 14-notification batch and replenishment on resume; do not imply unlimited delivery without reopening |
| Reset confirmation/cancel, restart after reset | Predictable destruction only after confirmation; correct empty-install state |
| Largest text, VoiceOver, light/dark, keyboard | Core action remains reachable; state is understandable without color alone; forms keep focused fields visible |
| Statistics, graphs and Share Progress | Known fixture totals agree; sharing preview/output and cancellation work on-device |

Record real-device baselines in [performance.md](performance.md), including device, OS, candidate, commit, dataset and date. Use fresh and approximately one-year histories. Existing targets: startup <1.5 s, resume <500 ms, IN/OUT <100 ms, tray change <150 ms, statistics <250 ms. Capture median/p95 and app/bundle size; investigate misses or explicitly accept a revised budget. Desktop Jest timings are not device performance evidence.

Done when: the candidate survives several days of normal wear tracking, all applicable scenarios pass, and there are no unresolved crashes, inaccessible core controls or material responsiveness problems.

## Conditional blockers: ship these features completely or defer them

### Paid features — deferred from 1.0

Production 1.0 must use `EXPO_PUBLIC_PAID_ACCESS_MODE=disabled`, hide Themes and Premium Support entry points, and redirect direct paid-feature routes. RevenueCat configuration and purchase verification are not release requirements for 1.0.

Before paid features ship in a future release:

- Verify production bundle `com.alecsbytes.alignertraytracker`, RevenueCat Apple public SDK key, offering `premium`, entitlement `aligner_tray_tracker_pro`, and all three products. Development Test Store uses `default` and is not Apple sandbox proof.
- Complete Apple agreements/tax/banking and product configuration. Put monthly/annual in one subscription group at the same service level; use a non-consumable for lifetime, per the existing purchase specification.
- Test purchase/restore for each product, reinstall, renewal/expiry, cancellation, pending/failed payment, offline cached access, refunds/revocations, lifetime plus expired subscription, and subscription management after lifetime purchase. Record actual Apple sandbox/TestFlight evidence separately from simulations.
- Verify localized full prices, billing periods, renewal disclosures, Terms, Privacy, Restore Purchases and Manage Subscription. No cloud account should be necessary. Billing failure must not block core tracking.
- Verify Premium Support is actually deliverable and paid access unlocks the promised current benefits. Subscription review requires ongoing value; explain the current service rather than relying on future feature promises. Static themes alone may be a weak subscription justification; this is a review risk, not a finding that Apple has rejected the product. [Apple subscription guidance, 3.1.2](https://developer.apple.com/app-store/review/guidelines/)
- Follow the existing release work tracked in the spec as #40–#43; their live issue status was not checked here.

Do not silently change prices or established future purchase rights when paid access is resumed.

### Cloud accounts / manual backup / restore — recommend first substantive update

Cloud Backup is disabled for production 1.0. Development and preview retain the implementation for future completion.

If cloud ships:

- Complete in-app initiation of account deletion, authenticated server cleanup of all owned snapshots/orphans/metadata and Auth identity, safe retries, and preservation of local treatment. Include Sign in with Apple token revocation and clear subscription-management information; deleting cloud data does not cancel App Store billing. Sign-out and Reset App are insufficient substitutes. [Apple account deletion requirements](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- Reorder the cloud roadmap as needed: deletion must precede public account availability; it cannot wait behind automatic backup simply because it is numbered Phase 2G.
- Run local Supabase policy tests and advisors; prove two users cannot access each other's backups. Verify production Apple auth, session lifecycle, upload/download and restore with the shipping bundle.
- Complete empty-install restore verification for old/current/unsupported/corrupt snapshots, interrupted uploads, failed imports, post-restore notifications and mature datasets. Restore must never overwrite an existing treatment.
- Clearly label manual backup, successful backup time and empty-install restore limitations. Signing in currently does not create a backup.
- Establish an honest retention policy and operational storage/failed-upload cleanup process. Automatic tiered retention can follow a manual-only launch if storage is monitored, deletion works and no automatic-retention promise is made; unbounded automatic uploads should not precede those controls.

Production uses `EXPO_PUBLIC_CLOUD_BACKUP_MODE=disabled`, removes cloud/restore entry points, guards direct routes, and skips cloud initialization. Preserve the implementation for later work.

### Siri / App Shortcuts — deferred from 1.0

Production omits the app-target App Intent declarations and skips shortcut
registration. The shared native module remains for phone notifications.
The following verification applies before a future Siri release.

Run the full [Siri verification matrix](features/siri-app-shortcuts.md): discovery after install/update; foreground/background/terminated/locked behavior; repeated and concurrent desired-state commands; schema compatibility; notification parity; and refresh of the normal tracker. If deferred, exclude shortcut registration from the release build and remove promotional claims. Retain any native notification functionality required by the phone app.

### Apple Watch — deferred from 1.0

Production omits the `@bacons/apple-targets` plugin and disables native
WatchConnectivity activation. Verify the replacement archive contains no Watch
app. Development and preview retain the target for a future update.

If included, verify Watch signing/provisioning, artwork and applicable store assets; test paired hardware, unreachable phone, timeouts, stale state, reconnection, rapid/retried requests, app lifecycle and consistent phone/watch totals. Follow [the Watch specification](features/apple-watch.md). Do not report success before the iPhone confirms persistence.

## What can come after initial release

| Priority | Update scope | Why it can wait |
|---|---|---|
| First maintenance update | Actual crash, correction, reminder and accessibility fixes from launch use | Protect the shipped daily workflow before adding features |
| First substantive update | Cloud account deletion + verified manual backup/restore, if deferred | Valuable data protection, but core utility is already local; release the complete account lifecycle together |
| Following cloud increment | Automatic foreground backup, tiered retention and trusted orphan cleanup | Follow the existing phased spec; preserve restore discovery before automatic uploads |
| Independent update | Verified Watch companion; Siri if deferred | Additional entry points create native/device test obligations but are not required for phone tracking |
| Later | Seasonal/animated themes, expanded graphs/sharing, optional consumable tips | Existing utility and color themes are enough; production tips are currently disabled |
| Explicit future project | Multi-device sync, Android/web release | Separate architecture/product decisions and platform QA; do not fold into 1.0 |

Avoid delaying release for analytics, engagement mechanics, new chart libraries, broad refactors or speculative performance infrastructure. Optimize measured problems. Existing implemented statistics/history/sharing need verification, not replacement.

## Execution order and submission

1. **Preserve the confirmed feature boundary.** Paid access, cloud, Siri, and Watch are excluded from 1.0. Verify the production archive and visible entry points match that scope. Suggested owners: product owner + developer.
2. **Close engineering blockers.** Recovery, full validation, native build/tests, production config checks and any included-feature gaps. Suggested owner: developer.
3. **Complete store setup in parallel.** Verify Developer Program membership, app record, bundle ID, distribution credentials/capabilities, EAS production environment, and hosted privacy/support pages. No purchase catalog or cloud service configuration is required for 1.0. Suggested owner: account holder.
4. **Build and distribute the signed candidate.** Follow the [production release workflow](development.md#build-and-release-to-production) using the validated commit and explicit production profile, then submit that exact artifact to TestFlight. This milestone is complete for the current candidate: it is available to internal testers and has been installed on a physical iPhone. Keep the build number tied to the validation evidence.
5. **Run the device matrix.** Allow several days of real use on the internal TestFlight candidate. Record evidence; rebuild/retest affected areas after fixes. Suggested owner: developer + testers.
6. **Prepare the store listing.** Follow the [App Store listing brief](app-store-listing.md) for the working name, subtitle, promotional text, description, keywords, and screenshot sequence. Complete the category, current age-rating questionnaire, copyright, support/privacy URLs, accurate device screenshots, and final icon. Verify the existing assets in the archive; do not assume unused starter files are shipped artwork. Decide iPhone/iPad availability explicitly and test any supported iPad presentation. Complete export-compliance answers based on the actual binary, territories/pricing, and EU trader status if distributing there.
7. **Submit for App Review.** Attach the chosen build and provide concise review notes explaining the offline, account-free setup and how to reach every included feature. Version 1.0 has no IAPs or cloud account to review. Select manual release to control launch timing.
8. **Release after approval.** Verify the public listing, fresh store install and purchase restoration; monitor App Store Connect crash feedback, support and service failures. Keep a tested patch path and the candidate's source/evidence. Avoid adding a telemetry SDK solely to satisfy this step.

Expo SDK 57 documents iOS 16.4+ and Xcode 26.4+; select a compatible EAS image and verify actual build logs. Apple currently requires Xcode 26+ with the relevant version-26 SDK for uploads. Building with a newer SDK does not require raising the app's minimum iOS version to 26. Recheck both sources when submitting. [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/), [Apple upload requirements](https://developer.apple.com/news/upcoming-requirements/)

EAS Submit uploads the build; it does not finish the listing or submit it for App Review. Complete those steps in App Store Connect. [Expo iOS submission](https://docs.expo.dev/submit/ios/)

## Final go/no-go checklist

- [ ] Production scope is explicit; deferred features have no accessible unfinished paths or unintended bundled targets.
- [ ] Automated validation and applicable native/database checks pass for the candidate commit.
- [ ] Startup recovery, migration/upgrade and core data-integrity scenarios pass.
- [ ] Physical-device daily-use, accessibility, notifications and performance evidence is recorded.
- [ ] Every advertised paid product purchases/restores correctly, or monetization is explicitly deferred.
- [ ] Any shipped account creation has complete deletion, Apple revocation and verified backup isolation/restore.
- [ ] Policies/support links, disclosures and store metadata match the binary.
- [ ] Signed TestFlight candidate has no unresolved launch blockers and is the build selected for review.

The signed candidate is now available for internal TestFlight testing, but there is no defensible public release date until device results, store metadata/privacy/support requirements, and App Store review status are complete. The shortest path is to finish this checklist with a deliberately bounded feature set, then schedule larger features as updates.
