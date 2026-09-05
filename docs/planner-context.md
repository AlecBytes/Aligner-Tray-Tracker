# Aligner Tracker — Planner Context

## Purpose
Preserve cross-feature product decisions, architecture direction, priorities, and planning workflow.

Use this hierarchy when documents overlap:
1. `docs/features/*.md` — exact feature behavior
2. `docs/mvp-plan.md` — overall product/MVP architecture
3. `docs/planner-context.md` — cross-feature priorities, product philosophy, roadmap
4. `AGENTS.md` — implementation-agent rules

When a product decision changes, update the most specific relevant document.

## Product Direction

Aligner Tracker is a minimal aligner-tracking app focused on making daily tracking exceptionally fast, useful, and reliable.

Platform direction:
1. iOS primary
2. Android and web later/secondary

iOS is the primary product platform. Android compatibility is not required for the planned Expo UI / SwiftUI migration.

### Primary Goals
1. Performance
   - fast startup
   - immediate local interaction
   - minimal computation/background activity
   - minimal network access
   - minimal dependency weight
2. Utility
   - important aligner information immediately available
   - few taps and low workflow friction
   - prioritize features that help daily aligner use

### Secondary Goals
3. Privacy
   - local storage by default
   - optional cloud later
   - collect only what a feature requires
4. User-Centric Policy
   - no mandatory account for core use
   - no dark patterns
   - no unnecessary engagement mechanics/gamification
   - no ads in the core product
   - users retain control over their data

## Product Thesis
> A fast, utility-first aligner tracker that gives users exactly the information and controls they need with almost no friction.

## Engineering Principle
> The user's phone runs the tracker. The cloud backs it up.

Cloud work is intentionally deferred until the local core app is excellent.

## Current Architecture

### Frontend
- React Native
- Expo
- TypeScript
- Expo Router
- Minimum iOS version: 16.4
- `@expo/ui/swift-ui` is the planned primary iOS UI layer.

### Planned iOS UI Direction
- Keep Expo Router for navigation and the React/TypeScript application shell.
- Build migrated screens primarily from native SwiftUI components exposed by Expo UI.
- Use iOS 26+ Liquid Glass styles and effects where they improve native fit and utility.
- Preserve the same layout, behavior, hierarchy, and accessibility on iOS 16.4–25 using compatible native SwiftUI styles.
- Treat this as a UI-layer migration. Preserve SQLite repositories, domain models, validation, calculations, notification policy, and business logic unless a separate task changes them.
- Prefer composition from Expo UI primitives over custom Swift or custom Expo modules.
- Keep app-specific composite components small and few. A custom SwiftUI/Expo module requires a verified Expo UI capability gap.
- Android compatibility is outside the migration requirements. Existing Android-specific code may remain during incremental work, but it must not constrain the iOS design.

See `docs/features/expo-ui-swiftui-migration.md` for the component map, screen-by-screen plan, rollout order, and verification gates.

### Persistence
- SQLite is the on-device source of truth.
- Core tracker behavior must not require network access.
- Persist source events/timestamps and derive calculated values where practical.

### Wear Tracking
- Timestamped `WearPunch` records represent IN/OUT state changes.
- Visible timers may refresh while the tracker is active, but persisted accuracy comes from timestamps.

### Treatment Plans
- `TreatmentPlanVersion` is append-only/versioned.
- Editing a plan inserts a new version.
- Historical versions remain unchanged.

### Trays
- A tray number may have multiple `TrayPeriod` records.
- Returning to a prior tray creates a new period.
- Exactly one tray period should be active at a time.

### Notifications
- Local-only reminders support the core workflow.
- Current concepts: OUT-too-long reminder, tray-change reminder, editable notification settings.

### Backend / Cloud
Deferred post-core. Confirmed direction when Cloud Backup & Restore is scheduled:
- Supabase for Sign in with Apple, private snapshot storage, and backup metadata
- automatic backup after sign-in, with SQLite remaining the on-device source of truth
- versioned logical snapshots and empty-installation restore
- no network dependency or cloud work on normal tracker action paths

Multi-device sync is a separate future feature, not part of Backup & Restore V1. Do not add cloud infrastructure until the corresponding feature is scheduled.

See `docs/features/cloud-backup-restore.md` and `docs/features/cloud-sync-future.md`.

## Core Tracker Behavior
The main tracker centers on:
- current tray as current / total
- current tray day
- days remaining, clamped at zero
- IN time today
- OUT time today
- one large IN/OUT toggle
- tray changing
- menu access

The user manually decides when to change trays. Prescribed days are for progress/reminders, not automatic advancement.

## Established Product Decisions

### Accounts
- No account required for core use.
- Sign in with Apple through Supabase is the confirmed optional account direction for Cloud Backup & Restore.
- Signing in automatically enables backup; signing out preserves retained backups, while cloud-account deletion deletes them and their metadata.
- Multi-device sync remains a separate future concern with unresolved product semantics.

### Treatment Plan Editing
- Editing appends a new version.
- History is preserved.
- History UI is separate from editing.

### Tray Changes
Allow:
- next tray
- previous tray
- manual tray number

Changing back to a used tray number creates a new `TrayPeriod`.

### Punch Corrections
Feature name: `Edit In/Out Times`

Flow:
1. menu entry
2. treatment-week/day browser
3. selected day's IN/OUT events
4. edit selected event

Rules:
- existing event status is read-only while editing timestamp
- timeline must preserve alternating `IN → OUT → IN → OUT`
- missing history uses user-oriented `Add Missing Time`, not raw punch insertion
- corrections must preserve tray-period boundaries

See `docs/features/edit-in-out-times.md`.

### Statistics
Local-only, read-only.

V1:
- Current Tray: days worn; avg IN/day; avg OUT/day; goal-met days / tracked days
- Treatment Overall: avg IN/day; avg OUT/day; goal-met days / tracked days
- Recent Days: last 7 treatment days with date, IN, OUT, goal met

Derived from source data; no persisted/cached stats in V1.
Historical goal evaluation respects the effective treatment-plan version.

See `docs/features/statistics.md`.

### Treatment Plan History
Read-only, accessed from Treatment Plan rather than a main-menu item.

V1 shows:
- all versions newest first
- current version clearly identified
- effective date/time
- total trays
- days per tray
- prescribed hours/day

No rollback, delete, historical edit, or comparison UI in V1.

See `docs/features/treatment-plan-history.md`.

### Notification Settings
Local, lightweight controls:
- OUT reminder enabled/disabled
- OUT reminder duration
- tray-change reminder enabled/disabled
- tray-change reminder local time

Settings changes should reconcile pending notifications without duplicates or polling.

See `docs/features/notification-settings.md`.

### Support Aligner Tracker
Optional and nonintrusive.

V1 direction:
- one-time consumable tips only
- no subscriptions within the tip feature
- tips grant no feature access
- no durable entitlement
- no account requirement
- no solicitation during normal tracking
- RevenueCat intended later as mobile purchase abstraction

See `docs/features/support.md`.

## Current Priority
Prioritize local app functionality before cloud work.

The planned iOS UI migration is incremental. Start with Treatment Setup and common forms/lists, then migrate supporting screens. Leave the custom Main Tracker until the shared Expo UI patterns, state bridging, navigation, accessibility, and iOS 16.4–25 fallbacks are proven.

Core expansion order:
1. Punch Corrections
2. Statistics
3. Treatment Plan History

Other local utility features:
- Notification Settings
- Support Aligner Tracker

Cloud/account work remains later unless priorities explicitly change. When scheduled, Cloud Backup & Restore comes before multi-device sync. Sync must wait until Backup & Restore is stable and the unresolved decisions in `docs/features/cloud-sync-future.md` are settled.

## Planning Workflow
For each meaningful feature:
1. Discuss product behavior first.
2. Identify unresolved UX/domain decisions.
3. Make concrete product decisions before Codex implementation.
4. Create/update `docs/features/<feature>.md`.
5. Treat the feature spec as durable source of truth.
6. Give Codex a short prompt pointing to `AGENTS.md`, `docs/mvp-plan.md`, and the feature spec.
7. Use a fresh Codex chat for a substantial new feature when useful.
8. Review Codex's summary and implicit decisions.
9. Manually smoke-test user-critical behavior.
10. Commit the completed feature before the next substantial task.

Do not rely on long AI conversation history as implementation memory.

## Implementation Guidance
Prefer:
- simple architecture
- feature-oriented modules
- repository/application boundaries around SQLite
- pure calculation functions where practical
- parameterized SQL
- transactions for multi-step changes
- minimal dependencies
- local deterministic behavior

Avoid by default:
- microservices
- micro-frontends
- global state frameworks without a concrete need
- cloud infrastructure before it is needed
- network calls on core tracker paths
- continuously persisted timers
- derived-data tables unless profiling justifies them
- chart libraries unless they clearly improve utility
- analytics/advertising SDKs in core functionality

## Documentation Discipline
When a product decision changes:
- update the relevant feature doc first
- update `docs/mvp-plan.md` if overall MVP behavior changes
- update this file if cross-feature priorities/architecture change
- update `AGENTS.md` only for broad implementation rules

Feature-specific requirements should not accumulate in `AGENTS.md`.

## App-wide Paid Access — confirmed 2026-09-05

Optional paid access launches at $0.99 USD/month, $7.99 USD/year, or $49.99 USD once for lifetime. All plans unlock all current and future paid features: while subscribed for monthly/annual, permanently for lifetime. No free trials or introductory discounts. Core utility stays free and tips grant no access.

Themes is the first paid feature, delivered Colors → Seasonal → Animated. Use one RevenueCat `premium` entitlement and explicit `premium` offering across subscription and lifetime products, independent of cloud authentication and consumable tips. Billing must never block local tracking. This is planned purchase behavior, not evidence of completed integration.

See `docs/features/paid-access.md` for commercial/access behavior and `docs/features/themes.md` for theme behavior. Future feature specs determine their own release scope without excluding paid features from existing lifetime ownership.
