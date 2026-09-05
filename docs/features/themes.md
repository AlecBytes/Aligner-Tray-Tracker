# Themes
## Status and scope
Phase 1 specification, 2026-09-05. Parent: [#25](https://github.com/AlecBytes/Aligner-Tray-Tracker/issues/25). Implementation: [#34](https://github.com/AlecBytes/Aligner-Tray-Tracker/issues/34).

Ready to start local implementation. RevenueCat configuration is required for integration testing; Apple subscription and lifetime purchase configuration and sandbox verification are required before Phase 1 is complete. This document specifies behavior, not evidence that billing is already configured.

Themes are optional paid cosmetics included in app-wide paid access. See `paid-access.md` for the authoritative pricing, lifetime scope, and shared entitlement contract. Core tracking, corrections, statistics, treatment plans, notifications, and access to personal data remain free. No app account is required.

## Repository baseline
Reviewed default branch main at b3e90fc33647bbd97e2e735582a4607e63d237ad:
- Existing theme foundation: `src/theme/tokens.ts` and `src/theme/use-app-theme.ts`.
- Existing light/dark primary colors are blue, not purple. Preserve today's free appearance under the name Default. Purple branding in the icon/splash does not establish the in-app palette.
- `react-native-purchases` is absent. Support currently uses mock or unavailable purchase services.
- Support is a separate consumable-tip feature. Implementing Themes does not require completing or enabling real tips.
- All app-owned iOS visuals must use Expo UI / SwiftUI, including the purchase screen. Retain the iOS UI purity gate.

This corrects the earlier issue assumption of free Purple and paid Blue: Default stays free; Purple replaces Blue in the five paid alternatives.

## Phase 1 behavior
Menu → Themes opens a native, scrollable list. Show Default first, followed by Purple, Teal, Green, Orange, Pink. Each row includes its name, a color swatch, and a selected or locked indicator with accessible text.

Follow system light/dark appearance; do not add an appearance-mode setting. Preview means swatches and a small static sample within the Themes/purchase screen, not temporarily applying a locked theme across the app.

For an entitled user, selecting a theme applies immediately and saves locally without a separate Save button. If persistence fails, return to the previous selection and show a retryable error.

For a locked theme, open the purchase screen and retain the tapped key only as an in-memory pending selection. Do not overwrite the saved preference until purchase/restore confirms access. On successful unlock, apply and save that pending choice. Cancellation, dismissal, pending payment, or failure keeps the previous preference.

The purchase screen:
- Describes access to the currently available color themes. Do not advertise Seasonal or Animated as available before they ship.
- Shows monthly, annual, and lifetime packages with localized full prices: recurring terms for subscriptions and one-time wording for lifetime. All unlock the same current and future paid features as released.
- Requires an explicit purchase tap. No automatic purchase, trial, introductory offer, countdown, or tracking-screen upsell.
- Includes Restore Purchases, Manage Subscription, Terms of Use, Privacy Policy, and a dismiss action.
- Disables duplicate purchase/restore submissions while pending.
- Treats cancellation as normal; shows useful retryable errors for failure.
- Shows “Purchase options are unavailable. Try again later.” when configuration/products/network are unavailable. Never invent a price or substitute a mock purchase in production.
- Unlocks only when returned customer information grants the app-wide `premium` entitlement; a successful transaction response alone is insufficient.
- For a pending/deferred transaction, explains that approval is pending and waits for entitlement updates.

Themes also exposes Restore Purchases and Manage Subscription. Use the platform subscription-management destination. Restoration must be user initiated. If no eligible subscription or lifetime purchase is found, say so without claiming a failure. Follow `paid-access.md` for lifetime ownership and existing-subscriber purchase behavior.

## Catalog and semantic colors
Use stable keys: `default`, `purple`, `teal`, `green`, `orange`, `pink`. All except `default` require entitlement `premium`.

Extend the existing token foundation; do not add a competing theming library. The following are exact initial values for app-owned primary styling. Values may be adjusted only to resolve a demonstrated accessibility/rendering issue, with this table updated in the same change.

| Key | Light primary | Light pressed | Light onPrimary | Dark primary | Dark pressed | Dark onPrimary |
|---|---|---|---|---|---|---|
| default | #1463FF | #0E4FCC | #FFFFFF | #73A5FF | #558DEA | #071126 |
| purple | #7E22CE | #6B21A8 | #FFFFFF | #C084FC | #A855F7 | #171020 |
| teal | #0F766E | #115E59 | #FFFFFF | #5EEAD4 | #2DD4BF | #071B18 |
| green | #15803D | #166534 | #FFFFFF | #86EFAC | #4ADE80 | #0B1C12 |
| orange | #C2410C | #9A3412 | #FFFFFF | #FDBA74 | #FB923C | #211207 |
| pink | #BE185D | #9D174D | #FFFFFF | #F9A8D4 | #F472B6 | #24101B |

All themes share the current neutral tokens:

| Token | Light | Dark |
|---|---|---|
| background | #F7F8FA | #0B0E14 |
| surface | #FFFFFF | #151A23 |
| text | #111827 | #F5F7FA |
| textMuted | #5F6B7A | #A9B2C1 |
| border | #D8DEE8 | #303846 |
| error | #B42318 | #FFB4AB |

Prefer native semantic labels, backgrounds, materials, disabled states, and role-based colors when controls supply them. Custom primary-filled controls use the matching onPrimary. Native controls retain native pressed/disabled behavior; primaryPressed is only for existing custom styling that needs it. Do not add decorative secondary-accent tokens without a current use.

Apply selected accents consistently to app-owned actions/tints and navigation infrastructure where supported. Preserve native defaults for the Default theme, including existing control tints. Errors, destructive actions, warnings, success, IN/OUT meaning, and graph-series identity must not become arbitrary theme accents. Do not recolor everything indiscriminately.

Scope covers iPhone app-owned screens, including setup, tracker, menu, forms, history/statistics, and purchase UI. It does not recolor the icon, launch screen, Apple purchase sheet, Watch app, widgets, or exported/shared images. Android/web billing and parity are deferred.

Verify light/dark combinations, large text, VoiceOver labels, and sufficient contrast on rendered native controls. State must never be conveyed by color alone.

## Preference and effective appearance
Persist one `selectedThemeKey` in existing local app-settings infrastructure. No theme-specific tables, treatment schema changes, or theme records in wear history. Missing/invalid keys resolve to Default.

Effective theme = selected theme + current themes access + system appearance.

When access lapses, retain the selected paid key but render Default. Show the saved choice as locked and explain that Default is in use. When access returns, automatically restore that saved choice. Explicitly selecting Default overwrites the preference and prevents an older paid choice from reappearing. Restoring on a fresh installation restores access, not the former device's theme selection.

Theme preference and purchase identity/access caches are not added to cloud treatment backups or synchronized by this feature. Never restore paid access from a treatment snapshot.

## Entitlement and offline policy
Use a small purchase-service boundary exposing availability, customer access, offering retrieval, purchase, restore, and subscription management. Screens do not interpret raw receipts or product IDs.

Use RevenueCat customer information for `premium`; do not grant access based on a local boolean, tip, offering availability, or selected key.

| Situation | Effective behavior |
|---|---|
| Free Default selected | Default, regardless of billing state |
| Active premium entitlement with valid access | Selected paid theme |
| Cancellation with paid period remaining | Keep access until expiration |
| Subscription expiration reached, without valid lifetime access | Default; keep preference |
| SDK-confirmed active lifetime access, including valid cached access | Selected paid theme; no scheduled expiry |
| Confirmed inactive/refunded/revoked entitlement | Default; keep preference |
| Network failure with still-valid cached access | Keep paid theme |
| No usable cached access, or unresolved initial status | Default while resolving asynchronously |
| Purchase/restore restores access | Apply pending tapped theme, otherwise saved preference |

Use the SDK's cached entitlement result and its validity rules; do not override an SDK-inactive result with an app-maintained “subscribed” flag. Add the project's stricter rule: a known subscription expiration at or before now does not grant offline access. Fresh service-confirmed billing grace may grant access; a failed refresh alone cannot infer renewal or grace. No app-defined extra grace period. A null expiration is not proof of access by itself. Confirmed active lifetime access has no expiry and must not be overridden by an expired subscription. Follow `paid-access.md` for refunds and overlapping grants.

Initialize billing once without holding the splash, route guards, SQLite load, or tracker interaction on its completion. Start with locally available state and update asynchronously. A brief Default appearance while uncached access resolves is acceptable; a blocking billing spinner on the tracker is not.

Subscribe once to customer-info updates, refresh opportunistically on foreground and opening Themes, and after purchase/restore. Deduplicate requests. No polling or fetches on timer ticks/IN/OUT actions. Re-evaluate a known expiration with one foreground-only timeout, cancelled/rescheduled on lifecycle or entitlement changes; also check on resume. No background scheduler.

Do not clear valid access merely because a request fails. Never send treatment data to RevenueCat. Purchase identity is independent of optional cloud sign-in/sign-out.

## RevenueCat setup and ownership
### Can begin now
Codex can build the registry, local preference, effective-theme resolver, native UI, service boundary, and deterministic test fixtures without dashboard setup. Mock access is allowed only in explicitly nonproduction configurations and tests. A mock-complete UI is not completed Phase 1.

### Before RevenueCat integration testing
Alec configures:
1. Create/reuse an Aligner Tracker RevenueCat project.
2. Create entitlement `premium`.
3. Create monthly, annual, and lifetime Test Store products, attach them to `premium`, and add their packages to offering `premium`.
4. Supply the Test Store public SDK key through the existing environment/config convention.

Use explicit offering `premium` rather than the current/default offering, so later tip offerings cannot accidentally populate the purchase screen. Product identifiers and prices belong to store configuration; the app consumes configured subscription and lifetime packages. Keep secret Apple credentials and RevenueCat secret API keys out of app bundles.

Codex integrates `react-native-purchases` compatible with the installed Expo/React Native versions and rebuilds the native development client. Use a custom Expo UI purchase screen without adding `react-native-purchases-ui`. Any eventual Support integration must reuse the same singleton SDK initialization.

### Before Apple sandbox and release
Alec configures the matching App Store Connect app, subscription group/products and lifetime non-consumable, product metadata, commercial agreements and required account details; connects the Apple app and required credentials in RevenueCat; maps Apple products to the same entitlement and offering; and provides the Apple public SDK key. Configure store notifications following RevenueCat guidance.

Production/preview bundle ID is currently `com.alecsbytes.alignertraytracker`; development is `com.alecsbytes.alignertraytracker.dev`. Test Store can support initial development. For Apple sandbox, use a build whose bundle ID matches the configured store app, or configure the development app separately. Do not assume production products work in the .dev app.

Use anonymous RevenueCat identity managed by the SDK; no Supabase account mapping. Use RevenueCat's “Transfer to new App User ID” restore policy for this account-free purchase model, and verify restoration after reinstall with the same App Store account.

Separate mock, Test Store, and Apple environments explicitly. Production release validation must reject mock/Test Store configuration. Missing billing configuration must fail safely in the UI without breaking core tracking. Document environment variables/build commands in README.

### Commercial terms and remaining release inputs
Confirmed in #38: $0.99 USD/month, $7.99 USD/year, and $49.99 USD lifetime. All plans unlock all current and future paid features, with permanent lifetime access and subscription access while active. No trials or introductory discounts; tips grant nothing. See `paid-access.md` for the shared purchase contract.

Final Terms of Use and Privacy Policy URLs and product metadata remain release inputs under #41. Test Store prices are test data, not permission to change launch terms. Local implementation can proceed before external setup.

## Delivery and verification
Complete in this order within #34:
1. Local colors, preference, resolver, SwiftUI UI, and isolated mock tests.
2. RevenueCat Test Store integration and error/entitlement handling.
3. Apple sandbox verification, production configuration validation, and documentation.

Required evidence:
- All five paid palettes and Default render correctly in light/dark mode; native styling is preserved.
- Selection survives restart; expiration preserves the key; renewal restores it; explicit Default wins.
- Unknown keys and missing billing configuration fail safely.
- Purchase success, cancellation, failure, pending approval, missing offerings, restore success/no access, cancellation-before-expiry, expiration, and revoked access behave as specified.
- Offline startup works with and without cached access; crossing known expiry falls back without polling.
- Real Apple sandbox purchase and restore work for monthly, annual, and lifetime, including reinstall with the same store account. Verify the lifecycle and overlapping-grant cases in `paid-access.md`. Test Store alone is insufficient.
- Production cannot activate mock/Test Store access. Real Support tips remain outside this task.
- Existing validation including iOS UI purity passes. Core SQLite behavior and notifications remain unchanged.
- Compare release-like startup, resume, IN/OUT latency and bundle size against the prior build per `docs/performance.md` (or its current repository location). Existing targets: startup <1.5 s, resume <500 ms, toggle <100 ms, tray change <150 ms. Do not add monitoring SDKs or a benchmark framework for this task.

## Later phases
Phase 2 (#35): one paid Seasonal selection resolving by local month; same entitlement, registry, and local preference. Determine monthly palettes in its own specification before implementation.
Phase 3 (#36): optional decorative animation using the same access contract, static fallback, Reduce Motion, foreground-only work, and measured performance.
Do not implement either phase's rendering, scheduling, or animation now.

## Documentation maintenance
Keep `paid-access.md` authoritative for commercial terms and shared access behavior; this file owns theme behavior. Planner context, the post-MVP roadmap, and Support distinguish app-wide paid access from free utility and tips. Update README with actual purchase environments, setup variables, rebuilds, product IDs, and verification when integration is implemented; do not document nonexistent configuration as working.

## Technical references
Checked 2026-09-05:
- [RevenueCat Expo integration](https://www.revenuecat.com/docs/getting-started/installation/expo)
- [Test Store versus platform sandbox](https://www.revenuecat.com/docs/test-and-launch/sandbox)
- [Customer information caching](https://www.revenuecat.com/docs/test-and-launch/debugging/caching)
- [Restore purchases](https://www.revenuecat.com/docs/getting-started/restoring-purchases)

## Codex handoff
Implement #34 using `docs/features/themes.md`, `AGENTS.md`, and relevant existing architecture docs. Complete the local foundation first, then integrate RevenueCat when configuration is available. Preserve native iOS UI and free local tracking. Update the listed docs and report completed versus externally blocked acceptance criteria; do not mark Phase 1 complete based only on mocks.

