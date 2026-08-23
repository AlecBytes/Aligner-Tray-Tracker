# Aligner Tracker — MVP Product & Architecture Plan

## Product Vision

A minimal, high-performance aligner tracking app focused first on **speed, responsiveness, reliability, and practical utility**.

The app should make the core action—tracking whether aligners are in or out—as fast and frictionless as possible.

### Primary Goals

1. **Performance**
   - Extremely fast startup and interaction.
   - Lightweight UI.
   - Minimal computation.
   - Minimal background activity.
   - Minimal network usage.
   - No network dependency for normal tracking.

2. **Utility**
   - Make the most important aligner-tracking information immediately visible.
   - Minimize taps and navigation.
   - Keep the main workflow simple enough to use throughout the day without becoming a burden.
   - Prefer a small number of excellent features over a large number of secondary features.

### Secondary Goals

3. **Privacy**
   - Store data locally by default.
   - Keep accounts and cloud services optional.
   - Minimize the personal information collected.
   - Secure data in transit and at rest where practical.
   - Separate account identity from treatment data where possible.

4. **User-Centric Policy**
   - No account required to use the core app.
   - No unnecessary data collection.
   - No dark patterns.
   - No unnecessary engagement mechanics, gamification, or distractions.
   - Users should retain control over their treatment data.

## Product Thesis

> **A fast, utility-first aligner tracker that gives users exactly the information and controls they need with almost no friction. The phone runs the tracker locally for maximum responsiveness and reliability; optional cloud services provide backup and synchronization while preserving a privacy-conscious, user-centric experience.**

### Engineering Principle

> **The user's phone runs the tracker. The cloud backs it up.**

---

# Platforms

Primary platform:

- iOS 16.4 or later

Frontend strategy:

- React Native
- Expo
- TypeScript
- Expo Router
- `@expo/ui/swift-ui` as the primary iOS UI layer
- SQLite as the local source of truth

The planned Expo UI / SwiftUI migration is iOS-first. Android compatibility is not required for this migration. Web and Android may remain secondary or separate concerns, but they must not constrain the migrated iOS interface.

Use native SwiftUI components exposed through Expo UI wherever possible. On iOS 26 and later, use appropriate Liquid Glass styles and effects. On iOS 16.4 through iOS 25, use compatible native SwiftUI fallback styles while preserving the same layout, behavior, content hierarchy, and accessibility.

Keep Expo Router for navigation. Preserve the existing SQLite, repository, domain, validation, calculation, and notification logic: this is a UI-layer migration, not a data or business-logic rewrite. Prefer Expo UI composition over custom Swift views or custom Expo modules.

See `docs/features/expo-ui-swiftui-migration.md` for the detailed migration plan.

---

# MVP Main View

The main view should contain only the information needed during normal daily use.

## Display

- Current tray number, e.g. `9 / 48`
- Current tray day, e.g. `Day 5`
- Days remaining on the current tray, e.g. `2 days left`
- Time aligners have been **IN** today
- Time aligners have been **OUT** today

IN/OUT time should display seconds.

Example:

```text
TRAY 9 / 48
Day 5
2 days left

IN TODAY
20:17:32

OUT TODAY
01:42:28

[ TRAYS ARE IN ]
 Tap when removed

Change Tray

☰
```

## Primary Control

A large toggle button controls the current aligner state:

- `TRAYS ARE IN`
- `TRAYS ARE OUT`

The button should be the dominant interactive element on the screen.

---

# Timer Behavior

The application should **not run a continuously persisted background timer**.

Instead, it stores timestamps when the user changes state.

Example:

```text
12:15 PM  OUT
12:51 PM  IN
6:34 PM   OUT
7:09 PM   IN
```

Elapsed time is calculated from these timestamps.

While the main screen is visible, the displayed timer can update once per second.

This design minimizes:

- battery use
- CPU use
- database writes
- background execution
- failure states

The timer remains accurate even if the app is closed or terminated.

---

# Treatment Setup

Initial setup asks for:

- Total number of trays
- Starting tray number
- Prescribed days per tray
- Prescribed hours per day

No treatment name is required.

The user manually controls when a tray actually changes.

The planned duration is informational and is used for remaining-day calculations and notifications.

---

# Current Tray Calculations

## Current Tray Display

Format:

```text
9 / 48
```

Meaning:

- current tray = 9
- total trays = 48

## Tray Day

The day a tray starts is `Day 1`.

## Days Remaining

Calculated as:

```text
prescribed days per tray - current tray day
```

The displayed result never falls below zero.

Example for a 7-day tray:

```text
Day 1 -> 6 days left
Day 2 -> 5 days left
Day 6 -> 1 day left
Day 7 -> 0 days left
Day 8 -> 0 days left
```

---

# Changing Trays

The Change Tray interface allows:

- Previous tray
- Next tray
- Enter tray number manually

Example:

```text
Change Tray

[ Previous ]   9 / 48   [ Next ]

Enter tray number: [____]

[ Cancel ]    [ Change ]
```

## Tray History Model

Changing back to a previously used tray does **not overwrite history**.

Instead, a new tray-wear period is created.

Example:

```text
Tray 8   Aug 1 -> Aug 8
Tray 9   Aug 8 -> Aug 11
Tray 8   Aug 11 -> Aug 13
Tray 9   Aug 13 -> ...
```

The same tray number may therefore appear multiple times in treatment history.

## Change Behavior When Current Tray Is OUT

If the current tray is already OUT:

- confirm that the user wants to start the new tray now
- close the current tray period
- start the new tray period
- leave the new tray state as OUT

The user taps IN after physically inserting the new tray.

## Change Behavior When Current Tray Is IN

If the current tray is currently IN:

- confirm that the current tray should be marked OUT
- create the OUT punch
- end the current tray period
- start the new tray period
- leave the new tray state OUT

This models the physical tray-change process accurately.

---

# Menu

MVP menu:

```text
Cloud Backup (iOS)
Treatment Plan
Help
```

Features that are not yet implemented should not appear as disabled menu items.

Android and web retain the informational **Account** destination while their authentication flow is deferred.

## Cloud Backup / Account

- iOS Sign in with Apple and local sign out
- Future cloud-account deletion
- Manual Cloud Backup status on iOS

An account is optional. A signed-in iOS user can create an explicit immutable snapshot with **Back Up Now**; sign-in itself does not run a backup. Automatic backup, restore, retention, and cloud-account deletion remain later phases. Multi-device sync is a separate future feature and is not part of Cloud Backup & Restore V1.

## Treatment Plan

Editable settings:

- Total trays
- Days per tray
- Hours per day

Saving an edit creates a **new treatment-plan version** instead of modifying historical settings.

The user sees only the current settings in the MVP.

## Help

- Getting Started guide
- Support email/contact information

---

# Treatment Plan Versioning

Treatment plans are stored separately from wear punches and tray periods.

Example:

```text
Version 1
48 trays
7 days/tray
22 hours/day
Effective Aug 1

Version 2
48 trays
10 days/tray
22 hours/day
Effective Sep 12
```

The application UI shows only the latest/current treatment plan.

Historical treatment-plan viewing may be added later.

---

# MVP Notifications

Only two notification types are required.

## Tray Change Reminder

Example:

> You are scheduled to change to Tray 9 today.

This is based on:

- the current tray start date/time
- the prescribed number of days per tray

## Out-Too-Long Reminder

Example:

> Your trays have been out for 45 minutes.

The initial threshold may default to 45 minutes.

User configuration can be added later if needed.

---

# Account Philosophy

An account is **not required**.

First-run experience:

```text
Install
  ↓
Treatment Setup
  ↓
Tracker
```

Not:

```text
Install
  ↓
Create Account
  ↓
Verify Email
  ↓
Login
  ↓
Treatment Setup
```

Phase 1 iOS authentication only connects an Apple account. When the later Cloud Backup & Restore phase is implemented, signing in with Apple will automatically enable:

- backup
- restore
- account management

The core tracker must remain fully functional without an account. Multi-device synchronization is a later, separately specified feature rather than an automatic consequence of enabling backup.

---

# Local-First Architecture

```text
              Expo / React Native shell
        Expo UI / SwiftUI on iOS 16.4+
                        │
                        ▼
                 Application Logic
                        │
                        ▼
                     SQLite
                SOURCE OF TRUTH
                        │
          deferred asynchronous backup work
                        │
              signed in + network
                        │
                        ▼
                    Supabase
          private snapshots + metadata
```

## Local Database

SQLite is the authoritative data source for normal app operation.

The application must not need the server to determine:

- current tray
- current tray day
- days remaining
- current IN/OUT state
- today's IN time
- today's OUT time
- treatment-plan settings
- whether a tray-change reminder is due

---

# Cloud Architecture

Cloud services are secondary to the tracker.

Primary cloud responsibilities:

- Sign in with Apple through Supabase
- automatic versioned snapshot backup after sign-in
- restore onto an empty installation
- backup retention and cloud-account deletion
- future synchronization only after its product semantics are resolved

The iOS authentication foundation and manual **Back Up Now** flow are available from the Cloud Backup menu. Automatic backup, restore, retention, account deletion, and sync remain deferred. Normal tracker interactions must not depend on Supabase or any network request.

See `docs/features/cloud-backup-restore.md` for the authoritative backup behavior and `docs/features/cloud-sync-future.md` for future sync constraints.

---

# Authentication

Current authentication foundation and confirmed direction:

- Supabase authentication
- Sign in with Apple as the account mechanism
- no account requirement for core tracking
- the current iOS phase connects the account and allows an explicit manual backup; sign-in alone does not create one
- a later backup phase automatically enables cloud backup after sign-in

Signing out preserves retained backups. Deleting the cloud account deletes its snapshots and backup metadata.

---

# Backend

Confirmed cloud platform for the deferred feature:

- Supabase authentication
- private logical-snapshot storage
- backup metadata protected by ownership policies
- trusted server-side work only where privileged retention or deletion requires it

SQLite remains the operational source of truth. Do not introduce a custom backend, microservices, or a second cloud platform for Backup & Restore or future sync.

---

# Frontend Architecture

Recommended:

- React Native
- Expo
- TypeScript
- Expo Router
- `@expo/ui/swift-ui` for the primary iOS UI layer
- SQLite
- lightweight application services/repository layer

Expo Router continues to own route structure and navigation. Migrated iOS screens should use a SwiftUI `Host` and compose native Expo UI controls such as `Form`, `Section`, `List`, `Text`, `Button`, `TextField`, `Toggle`, `Picker`, `DatePicker`, `Alert`, and SwiftUI layout stacks.

Use native semantic styling first. Apply Liquid Glass styles/effects only on iOS 26+ and use native, non-glass SwiftUI equivalents on iOS 16.4–25 without changing screen behavior. Keep custom app components limited to small compositions of Expo UI primitives. Add custom SwiftUI or a local Expo module only after confirming that Expo UI cannot provide a required capability.

This migration must not replace SQLite or rewrite repositories, domain models, validation, calculations, notifications, or other business logic. Android parity is not a migration requirement.

Use a modular application shell instead of true micro frontends.

Example logical modules:

```text
App Shell
├── Tracker
├── Treatment Plan
├── Cloud Backup (Account on Android/web)
└── Help
```

True micro-frontends are intentionally deferred because they would add runtime, deployment, navigation, state-sharing, and dependency complexity without improving the MVP.

---

# Local Data Model

## Treatment

```text
Treatment
---------
Id
CreatedAt
```

## TreatmentPlanVersion

```text
TreatmentPlanVersion
--------------------
Id
TreatmentId
TotalTrays
DaysPerTray
DailyWearGoalMinutes
EffectiveAt
CreatedAt
```

## TrayPeriod

```text
TrayPeriod
----------
Id
TreatmentId
TrayNumber
StartedAt
EndedAt
```

A tray number may have multiple TrayPeriod records.

## WearPunch

```text
WearPunch
---------
Id
TrayPeriodId
Status
Timestamp
```

Status values:

```text
IN
OUT
```

Example:

```text
08:00  IN
12:15  OUT
12:51  IN
18:34  OUT
19:09  IN
```

The application derives durations from this event timeline.

## Settings

Initial examples:

```text
Settings
--------
OutReminderMinutes
NotificationsEnabled
```

Do not add sync-related metadata until the future sync product decisions are resolved.

---

# Future Synchronization Constraints

Multi-device sync is separate from Cloud Backup & Restore V1 and is not ready for implementation. Its established technical direction is:

- SQLite remains each device's operational source of truth
- local writes complete before network work
- durable outbound operations
- batched, idempotent server operations
- incremental cursors for incoming changes
- no network dependency for normal tracking

Example:

```text
User taps OUT
      ↓
SQLite write
      ↓
UI updates immediately
      ↓
Durable operation queued
      ↓
Cloud synchronization occurs later
```

The user should never wait for an API response before seeing a timer-state change. Conflict resolution, deletion semantics, device limits, sign-out behavior, and restored-backup reconciliation must be decided before sync implementation begins.

See `docs/features/cloud-sync-future.md` for the complete entry criteria and unresolved decisions.

---

# Performance Requirements

Performance is the primary engineering differentiator.

## Core Tracker Requirements

- no network request required to open the tracker
- no API call required for IN/OUT actions
- no polling
- no continuously persisted background timer
- minimal background work
- minimal database writes
- calculations based primarily on timestamps
- lightweight screen hierarchy
- minimal dependencies
- avoid unnecessary animation libraries
- avoid unnecessary analytics SDKs
- avoid ad SDKs
- avoid excessive state-management infrastructure

The main tracker should feel immediately usable after launch.

---

# Privacy Principles

Privacy is a secondary but important design goal.

## Local by Default

Unsigned users keep treatment data on their device.

## Optional Cloud

Cloud services remain optional. Phase 1 iOS sign-in only connects the account. When the later Cloud Backup & Restore phase is implemented, choosing to sign in with Apple automatically enables backup. Future multi-device sync remains a separate capability and must not be inferred from backup sign-in.

## Data Minimization

The treatment system should avoid collecting information that is not necessary.

Examples of information the treatment-data model should not require:

- legal name
- physical address
- phone number
- exact location
- orthodontist
- contacts
- advertising identifiers

## Identity Separation

Authentication identity should be separated from treatment-domain records where practical.

Cloud treatment records should primarily reference opaque internal identifiers rather than directly embedding identity information.

---

# User-Centric Policy

Product decisions should favor the user's interests.

Principles:

- no mandatory signup
- no unnecessary collection
- no dark patterns
- no forced engagement
- no artificial streaks or badges
- no ads in the MVP
- no unnecessary notifications
- simple account deletion
- clear cloud-backup behavior
- user-controlled data

---

# Explicitly Out of MVP

Do not include:

- forgotten-punch editing
- statistics dashboard
- charts
- photos
- orthodontist integration
- treatment-plan history UI
- social features
- gamification
- streaks
- ads
- donation screen
- CSV export
- email statistics
- Cloud Backup & Restore
- multi-device sync

---

# Early Post-MVP Roadmap

## 1.1 — Punch Corrections

Allow users to correct forgotten or incorrect IN/OUT taps.

## 1.2 — History

Provide a minimal history view for:

- tray periods
- daily wear totals
- IN/OUT events

## 1.3 — Statistics

Add useful treatment statistics without compromising UI simplicity.

## 1.4 — CSV Export

Allow users to export tray and wear statistics.

Possible later capability:

- email CSV statistics

## Later

Potential future features:

- Cloud Backup & Restore, after the local core is excellent
- multi-device sync, only after Backup & Restore is stable and sync semantics are resolved
- treatment-plan history UI
- photos/check-ins
- orthodontist integration
- donations

These should be evaluated only after the core tracker experience is excellent.

---

# MVP Success Criteria

The MVP succeeds if a user can:

1. Install the app.
2. Configure a treatment plan quickly.
3. Immediately see their current tray and progress.
4. Mark trays IN or OUT with one obvious action.
5. Trust the timer even after closing the app.
6. Change trays without losing historical information.
7. Receive the two essential reminders.
8. Use the entire core tracker without creating an account.
9. Use the tracker without an internet connection.

The quality bar is not the number of features.

The quality bar is how **fast, reliable, useful, and frictionless** the core experience feels.
