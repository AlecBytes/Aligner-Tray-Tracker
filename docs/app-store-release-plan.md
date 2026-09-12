# App Store release plan

Reviewed September 11, 2026. Target: iPhone, iOS 16.4+, version 1.0.

## Recommendation

The app has enough functionality for an initial release. Focus remaining work on reliability, production purchases, support/privacy, and proving the signed build on physical devices. Additional tracker features are not the missing ingredient.

Recommended 1.0: ship the existing local tracker, corrections, treatment plans/history, statistics/graphs, notifications, Share Progress, Help, and the existing color themes/Premium Support once production billing is verified. Defer cloud accounts/backup and Apple Watch unless their conditional launch gates below are completed. Keep Siri only after its existing device-verification gate passes.

This is a proposed release boundary, not an implemented feature switch or a replacement for the confirmed commercial decision in [Paid Access](features/paid-access.md). Monthly ($0.99 US), annual ($7.99 US), and lifetime ($49.99 US) remain the documented plans. A free-only first release is a fallback product decision if billing delays launch; it would require deliberately removing paid entry points and adjusting the production configuration guard.

## What exists, and what the review established

| Area | Evidence in the repository | Assessment |
|---|---|---|
| Local tracker | Setup, IN/OUT, tray changes, treatment versioning, corrections, statistics and SQLite migrations/repository tests | Substantially implemented; retain and harden |
| iOS presentation | SwiftUI screen implementations; dependency-aware UI purity guard | Guard passes; visual/accessibility testing still required |
| Notifications | Settings, native coordinator, shared Swift/TypeScript policy fixtures | Implemented; automated parity result and physical delivery need verification |
| Paid access | RevenueCat iOS adapter, access lifecycle tests, paywall, themes and Premium Support | Integration exists; production catalog and real Apple transactions are not proven by this review |
| Cloud | Apple sign-in, manual snapshots, empty-install restore | Partial release readiness; deletion remains planned and restore verification remains open |
| Siri / Watch | Local Swift module, App Intents, XCTest source, Watch target and connectivity code | Real implementations, not just roadmap ideas; native build/device evidence still needed |
| Release configuration | Bundle ID, EAS project, production profile and remote build numbering | Foundation exists; signing, store record and uploaded artifact not checked |
| Recovery / automation | Root layout has no exported error boundary; EAS production workflow only builds | Confirmed gaps |
| Support / policies | `support@example.com` in app config; policy URLs supplied through environment | Default support is unavailable; live policy configuration must be verified |

Inspected product/feature documents, release configuration, route/provider wiring, relevant screens and test coverage. This is a repository readiness review, not a complete line-by-line security audit or a physical-device UX review. No Apple, EAS, RevenueCat or Supabase dashboard state was verified. Missing values in checked-in configuration may exist in hosted environments; do not assume they are absent remotely.

Validation on Node v22.13.0:

- TypeScript and ESLint passed.
- iOS UI purity passed: 127 app-owned modules reachable from 62 roots.
- The validation invocation passed 60 Jest suites / 369 tests, but the notification parity suite failed to run with a Jest worker circular-error serialization message. The suite invokes child Node processes for timezone checks. This result does not establish a notification logic defect, but it does not constitute a green release gate either.
- An isolated rerun (`npm test -- --runInBand src/features/notifications/notification-policy-parity.test.ts`) passed 17 cases and failed five timezone/DST cases with `spawnSync ... node ETIMEDOUT`, each at the configured five-second subprocess timeout. The underlying cause remains unconfirmed; distinguish an execution-environment problem from a policy defect before changing behavior.
- Native XCTest, archive/signing, device measurements, Apple sandbox transactions and Supabase policy tests were not run in this review.

The older [Expo audit follow-ups](expo-audit-follow-ups.md) still correctly identifies recovery, performance evidence and build gating gaps, but its closing paragraph calling restore future work is stale. The [cloud feature specification](features/cloud-backup-restore.md) and current code show empty-install restore is implemented.

## Critical before every 1.0 release

### 1. Protect local data and recover from startup failures

- Add the documented root Expo Router error boundary around bootstrap failures, with SwiftUI recovery UI and a safe retry. Ensure the splash screen cannot hide the failure indefinitely. Retry must never reset or overwrite the database.
- Exercise initialization/migration failures, interrupted saves, duplicate taps and reset cancellation. Verify that failed writes preserve the previous valid state.
- Run upgrade tests against prior database versions with realistic history; verify native schema compatibility whenever Siri/native writes remain present.
- Keep all SQLite mutation work consistent with [the transaction policy](sqlite-transactions.md). Preserve exactly one active tray, alternating punches, historical plan versions and tray boundaries.

Done when: fresh install and upgrade work; failure recovery preserves records; no known data-loss, duplicate-transition or timeline-corruption defect remains.

### 2. Make the release validation gate reproducible

- Diagnose the notification parity failure in a supported environment, including its child-process execution. Fix the actual cause or environment setup and obtain a complete green suite; do not skip the suite to release.
- Add a validation dependency before the production build in `.eas/workflows/`, using the pinned Node version, lockfile install and `npm run validate`. Include Expo dependency compatibility checks and Expo Doctor, with any exceptions explained.
- Run the local module's native XCTest suite on macOS and verify clean generated iOS projects compile. Jest plugin tests do not compile Swift or prove App Intent discovery.
- Record commit, commands, environment and results with the release candidate. Ensure the candidate is built from that validated commit.

Done when: all applicable automated checks pass and a validation failure prevents the normal production workflow from building.

### 3. Finish support, privacy and release copy

- Replace `support@example.com` in `app.json` with a monitored address. Verify standard email support, copy-address fallback, and the advertised priority-support workflow.
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

### Paid features — recommended in 1.0 under the existing commercial decision

- Verify production bundle `com.alecsbytes.alignertraytracker`, RevenueCat Apple public SDK key, offering `premium`, entitlement `aligner_tray_tracker_pro`, and all three products. Development Test Store uses `default` and is not Apple sandbox proof.
- Complete Apple agreements/tax/banking and product configuration. Put monthly/annual in one subscription group at the same service level; use a non-consumable for lifetime, per the existing purchase specification.
- Test purchase/restore for each product, reinstall, renewal/expiry, cancellation, pending/failed payment, offline cached access, refunds/revocations, lifetime plus expired subscription, and subscription management after lifetime purchase. Record actual Apple sandbox/TestFlight evidence separately from simulations.
- Verify localized full prices, billing periods, renewal disclosures, Terms, Privacy, Restore Purchases and Manage Subscription. No cloud account should be necessary. Billing failure must not block core tracking.
- Verify Premium Support is actually deliverable and paid access unlocks the promised current benefits. Subscription review requires ongoing value; explain the current service rather than relying on future feature promises. Static themes alone may be a weak subscription justification; this is a review risk, not a finding that Apple has rejected the product. [Apple subscription guidance, 3.1.2](https://developer.apple.com/app-store/review/guidelines/)
- Follow the existing release work tracked in the spec as #40–#43; their live issue status was not checked here.

If billing is deferred: explicitly revise launch scope, hide paid theme purchase paths and Premium Support/paywall entry points, and adjust `app.config.js`, which currently requires Apple paid-access mode for production. Merely omitting the API key leaves reachable unavailable purchase UI. Do not silently change prices or established purchase rights.

### Cloud accounts / manual backup / restore — recommend first substantive update

The current Menu exposes Cloud Backup and setup supports restore. Keeping either account-creation path makes deletion a launch dependency even though the tracker itself needs no account.

If cloud ships:

- Complete in-app initiation of account deletion, authenticated server cleanup of all owned snapshots/orphans/metadata and Auth identity, safe retries, and preservation of local treatment. Include Sign in with Apple token revocation and clear subscription-management information; deleting cloud data does not cancel App Store billing. Sign-out and Reset App are insufficient substitutes. [Apple account deletion requirements](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- Reorder the cloud roadmap as needed: deletion must precede public account availability; it cannot wait behind automatic backup simply because it is numbered Phase 2G.
- Run local Supabase policy tests and advisors; prove two users cannot access each other's backups. Verify production Apple auth, session lifecycle, upload/download and restore with the shipping bundle.
- Complete empty-install restore verification for old/current/unsupported/corrupt snapshots, interrupted uploads, failed imports, post-restore notifications and mature datasets. Restore must never overwrite an existing treatment.
- Clearly label manual backup, successful backup time and empty-install restore limitations. Signing in currently does not create a backup.
- Establish an honest retention policy and operational storage/failed-upload cleanup process. Automatic tiered retention can follow a manual-only launch if storage is monitored, deletion works and no automatic-retention promise is made; unbounded automatic uploads should not precede those controls.

If deferred: remove cloud/restore entry points and guard direct routes, disable cloud initialization/account creation in the production variant, and update Help/store copy. Missing environment variables alone are insufficient because they leave a visible unavailable feature. Preserve the implementation for later work.

### Siri / App Shortcuts — keep only if its existing release gate passes

Run the full [Siri verification matrix](features/siri-app-shortcuts.md): discovery after install/update; foreground/background/terminated/locked behavior; repeated and concurrent desired-state commands; schema compatibility; notification parity; and refresh of the normal tracker. If deferred, exclude shortcut registration from the release build and remove promotional claims. Retain any native notification functionality required by the phone app.

### Apple Watch — recommend an update

The Watch target is already included through `@bacons/apple-targets`; hiding phone UI does not remove it from an archive. If deferred, explicitly exclude the Watch target from production generation and verify the archive.

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

1. **Freeze the feature boundary.** Record whether paid access, cloud, Siri and Watch are included. Apply production exclusions for deferred features and update conflicting documentation. Suggested owners: product owner + developer.
2. **Close engineering blockers.** Recovery, full validation, native build/tests, production config checks and any included-feature gaps. Suggested owner: developer.
3. **Complete store/service setup in parallel.** Verify Developer Program membership, app record, bundle ID, distribution credentials/capabilities, EAS production environment, hosted policies/support and purchase catalog. These are external setup tasks, not confirmed missing accounts. Suggested owner: account holder.
4. **Build the signed candidate.** Use the validated commit and explicit production profile, then submit that exact artifact to TestFlight. Existing `eas.json` has auto-increment but an empty submission profile; configure the App Store Connect app ID and submission credentials. Verify all included targets have correct signing.
5. **Run the device and purchase matrices.** Allow several days of real use. Record evidence; rebuild/retest affected areas after fixes. Suggested owner: developer + testers.
6. **Prepare the store listing.** Final name/subtitle/description/keywords, category, current age-rating questionnaire, copyright, support/privacy URLs, accurate device screenshots and final icon. Verify the existing assets in the archive; do not assume unused starter files are shipped artwork. Decide iPhone/iPad availability explicitly and test any supported iPad presentation. Complete export-compliance answers based on the actual binary, territories/pricing, and EU trader status if distributing there.
7. **Submit for App Review.** Attach the chosen build and applicable first IAPs, provide purchase review material and concise review notes explaining offline setup, free vs paid features, and how to reach every included feature. Provide any access/instructions Apple needs to review cloud behavior if shipped. Select manual release to control launch timing.
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

There is no defensible calendar release date until device results and external purchase/store setup are known. The shortest path is to finish this checklist with a deliberately bounded feature set, then schedule larger features as updates.
