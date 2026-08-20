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
   - Keep cloud synchronization optional.
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
Account
Treatment Plan
Help
```

Features that are not yet implemented should not appear as disabled menu items.

## Account

- Sign in
- Create account
- Sign out
- Basic profile information
- Cloud backup status

An account is optional.

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

Account creation enables cloud-oriented features such as:

- backup
- restore
- multi-device synchronization
- account management

The core tracker must remain fully functional without an account.

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
                    Sync Queue
                        │
              signed in + network
                        │
                        ▼
                 ASP.NET Core API
                     .NET 10
                        │
                     EF Core
                        │
                        ▼
                    Azure SQL
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

- authentication
- optional backup
- synchronization
- restore
- multi-device support
- future export services

Normal tracker interactions should not depend on the cloud API.

---

# Authentication

Recommended approach:

- OAuth 2.0
- OpenID Connect
- PKCE for mobile authorization flows
- JWT bearer tokens for API authentication

Potential identity provider:

- Microsoft Entra External ID

Authentication credentials should be handled by the identity provider rather than stored in the application database.

---

# Backend

Recommended backend:

- ASP.NET Core Web API
- .NET 10
- Entity Framework Core
- SQL Server / Azure SQL

Architecture:

- modular monolith
- feature-oriented organization
- REST API
- no microservices for MVP

Example feature areas:

```text
Account
Treatments
TreatmentPlans
TrayPeriods
WearTracking
Sync
Notifications
```

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
├── Account
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

Sync-related metadata can be added separately.

---

# Synchronization Strategy

Cloud synchronization should be:

- asynchronous from the user's perspective
- opportunistic
- batched when practical
- unnecessary for normal tracking
- resilient to loss of connectivity

Example:

```text
User taps OUT
      ↓
SQLite write
      ↓
UI updates immediately
      ↓
Sync queued
      ↓
Cloud synchronization occurs later
```

The user should never wait for an API response before seeing a timer-state change.

Possible synchronization opportunities:

- app startup
- app resume
- shortly after meaningful changes
- when account state changes
- when network connectivity is available

Avoid:

- polling
- API calls on every timer tick
- mandatory API calls for IN/OUT actions

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

Cloud storage is activated only when the user chooses account-based services.

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
10. Optionally enable cloud backup without changing the core app experience.

The quality bar is not the number of features.

The quality bar is how **fast, reliable, useful, and frictionless** the core experience feels.
