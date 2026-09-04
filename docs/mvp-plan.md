# Aligner Tracker — MVP Product & Architecture Plan

## Purpose

Aligner Tracker is a minimal, high-performance aligner tracking app focused on making daily clear-aligner tracking fast, reliable, and useful.

This document defines the overall product direction, current MVP scope, architecture, and near-term roadmap.

When requirements overlap, use this source-of-truth order:

1. `docs/features/*.md` — exact feature behavior
2. `docs/mvp-plan.md` — overall product and MVP architecture
3. `docs/planner-context.md` — cross-feature priorities and planning context
4. `AGENTS.md` — implementation-agent rules

Feature documents override this document when defining detailed behavior.

---

# Product Priorities

## 1. Performance

The tracker should feel immediate.

Requirements:

- fast startup
- immediate IN/OUT interactions
- no network dependency for normal tracking
- minimal computation
- minimal background activity
- minimal database writes
- minimal dependencies
- no unnecessary polling

## 2. Utility

The app should make the information needed during normal aligner use immediately accessible.

Prefer:

- few taps
- obvious controls
- useful treatment information
- small, focused screens
- practical features over engagement features

## 3. Privacy

- SQLite is the local source of truth.
- Core tracking requires no account.
- Cloud features are optional.
- Collect only information required by a feature.
- Do not make normal tracking dependent on remote infrastructure.

## 4. User-Centric Policy

- no mandatory signup
- no dark patterns
- no advertising
- no artificial streaks or gamification
- no unnecessary notifications
- no feature degradation for users who do not purchase optional support products
- users retain control over their treatment data

---

# Product Thesis

> **A fast, utility-first aligner tracker that gives users the information and controls they need with almost no friction.**

Engineering principle:

> **The user's phone runs the tracker. The cloud backs it up.**

---

# Primary Platform

Primary target:

- iOS 16.4+

Current stack:

- Expo
- React Native
- TypeScript
- Expo Router
- `@expo/ui/swift-ui` for iOS presentation
- SQLite
- local notifications

Android and web remain secondary platforms and must not constrain the iOS experience.

The iOS Expo UI / SwiftUI migration is complete. Existing non-iOS React Native screens remain platform fallbacks.

See `docs/features/expo-ui-swiftui-migration.md`.

---

# Current MVP Status

The local-first core MVP is substantially implemented.

The immediate product milestone is now:

> **Harden the existing core experience for reliable daily use and release, rather than expanding the MVP with unrelated features.**

Implemented core functionality includes:

- treatment setup
- main IN/OUT tracker
- timestamp-based wear tracking
- tray changes
- versioned treatment plans
- Edit In/Out Times
- statistics
- statistics graphs
- treatment-plan history
- configurable local notifications
- Help / Getting Started
- local-first operation without an account
- iOS native Expo UI / SwiftUI presentation

Optional cloud foundations also exist but are not required for core tracking.

---

# Main Tracker

The Tracker is the primary daily-use screen.

It provides:

- current tray number / total trays
- current tray day
- days remaining
- IN time today
- OUT time today
- current IN/OUT state
- large IN/OUT control
- access to Change Tray
- access to recent punch editing where applicable

The IN/OUT action should remain the dominant interaction.

Core tracker actions must never wait for the network.

---

# Wear Tracking Model

The application does not persist a continuously running timer.

Instead, it records timestamped state transitions.

Example:

```text
08:00  IN
12:15  OUT
12:51  IN
18:34  OUT
19:09  IN
```

`WearPunch` records are the authoritative event history.

Displayed durations are calculated from these timestamps.

The visible timer may refresh once per second while the Tracker is active, but persisted accuracy comes from timestamps rather than background timer execution.

This minimizes:

- battery use
- CPU work
- background execution
- database writes
- failure states

---

# Treatment Setup

Initial treatment setup captures:

- total number of trays
- starting tray number
- prescribed days per tray
- prescribed wear hours per day

No treatment name or account is required.

The user manually determines when a physical tray change actually occurs.

Prescribed tray duration is used for progress calculations, remaining-day display, and tray-change notifications. It does not automatically advance the tray.

---

# Tray Changes

The Change Tray flow supports:

- next tray
- previous tray
- manually entered tray number

A tray number may be worn more than once.

Returning to a previously used tray creates a new `TrayPeriod`; previous history is never overwritten.

Exactly one `TrayPeriod` should be active at a time.

When changing trays, the outgoing tray is completed and the new tray starts OUT. The user records IN after physically inserting the new tray.

---

# Treatment Plans

Treatment plans are append-only and versioned.

Editing total trays, days per tray, or prescribed wear hours creates a new `TreatmentPlanVersion`.

Historical plan versions are never silently rewritten.

Historical statistics use the plan version that was effective for the date being evaluated.

---

# Treatment Plan History

Treatment Plan History is implemented as a read-only view accessed from the Treatment Plan screen.

It shows:

- all treatment-plan versions
- newest first
- current version identification
- effective date/time
- total trays
- days per tray
- prescribed wear goal

It does not support rollback, delete, historical editing, or comparison.

See `docs/features/treatment-plan-history.md`.

---

# Edit In/Out Times

Users can inspect and correct their wear history through:

```text
Menu
  ↓
Edit In/Out Times
  ↓
Date History
  ↓
Day
  ↓
IN/OUT Events
  ↓
Edit Event / Add Missing Time
```

This flow also serves as the app's detailed IN/OUT history browser. A separate duplicate read-only History menu is not required.

Corrections must preserve:

- alternating IN / OUT state
- valid chronology
- tray-period boundaries

See `docs/features/edit-in-out-times.md`.

---

# Statistics

Statistics are calculated locally from source data.

Do not persist duplicate statistics tables unless profiling demonstrates a real performance need.

Current statistics include:

## Current Tray

- days worn
- average IN time per tracked day
- average OUT time per tracked day
- goal-met days / tracked days

## Treatment Overall

- average IN time per tracked day
- average OUT time per tracked day
- goal-met days / tracked days

## Recent Days

Recent treatment days show:

- date
- IN duration
- OUT duration
- whether the prescribed goal was met

Historical calculations respect the treatment-plan version effective on each day.

---

# Statistics Graphs

The Statistics Graphs MVP is implemented.

Available graphs:

- Wear Time
- Goal Progress
- Tray Progress

Shared ranges:

- 7 Days
- 30 Days
- Treatment

Graphs use native platform capabilities rather than introducing a third-party chart dependency.

See `docs/features/statistics.md`.

---

# Notifications

Notifications are local.

## OUT Reminder

Reminds the user when trays have remained OUT longer than the configured duration.

Settings include:

- enabled / disabled
- initial OUT duration
- persistent reminder interval

## Tray Change Reminder

Reminds the user when the prescribed tray duration has been reached.

Settings include:

- enabled / disabled
- reminder time

Notification changes should reconcile scheduled notifications without polling or duplicates.

See `docs/features/notification-settings.md`.

---

# Menu

Current iOS product areas include:

```text
Cloud Backup
Treatment Plan
Notifications
Edit In/Out Times
Statistics
Help
Reset App
```

Support may appear where appropriate during development or after the purchase implementation is ready.

Do not add disabled placeholders for unimplemented future features.

---

# Account Philosophy

An account is not required.

Normal first-run flow remains:

```text
Install
  ↓
Treatment Setup
  ↓
Tracker
```

Core tracking must continue to function signed out, offline, and without Supabase availability.

Optional accounts exist to support cloud capabilities, not to gate the tracker.

---

# Local-First Architecture

```text
             Expo / React Native shell
           Expo UI / SwiftUI on iOS
                       │
                       ▼
              Application / Domain
                       │
                       ▼
                    SQLite
               SOURCE OF TRUTH
                       │
             optional cloud work
                       │
                       ▼
                   Supabase
```

SQLite remains authoritative for:

- current treatment
- treatment-plan versions
- tray periods
- wear punches
- notification settings
- tracker state
- statistics calculations

The app must not require a server to determine the user's current IN/OUT state.

---

# Local Data Model

Core authoritative entities:

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

A tray number may have multiple periods.

## WearPunch

```text
WearPunch
---------
Id
TrayPeriodId
Status
Timestamp
```

Status values are `IN` and `OUT`.

Derived values such as wear duration and statistics should generally remain calculations rather than authoritative stored state.

---

# Cloud Backup

Cloud Backup is optional and secondary to the tracker.

Current implementation includes:

- Supabase foundation
- Sign in with Apple on iOS
- private snapshot storage and metadata
- deterministic mobile snapshot serialization
- manual **Back Up Now**
- empty-installation restore on iOS

Signing in does not currently imply that an automatic backup has occurred.

Core tracker actions never depend on Supabase.

See `docs/features/cloud-backup-restore.md`.

---

# Deferred Cloud Work

Still planned:

- automatic backup
- backup retention
- cloud-account deletion
- trusted orphan cleanup where required

These features should be implemented incrementally without moving SQLite out of the source-of-truth role.

---

# Multi-Device Sync

Multi-device synchronization is a separate future feature.

It is not part of Backup & Restore V1.

Before implementation, product decisions must resolve:

- conflict behavior
- deletion semantics
- device limits
- offline reconciliation
- sign-out behavior
- restored-backup reconciliation

Any future sync architecture must preserve:

```text
User action
    ↓
SQLite write
    ↓
UI updates immediately
    ↓
network synchronization later
```

See `docs/features/cloud-sync-future.md`.

---

# Support Aligner Tracker

Optional financial support must not interfere with normal tracking.

Current product direction:

- user intentionally opens Support
- one-time tips first
- no subscriptions initially
- no feature gating
- no required account
- no tracker banners or popups
- no guilt-based or repeated solicitation

RevenueCat is the intended purchase abstraction when store purchases are completed.

See `docs/features/support.md`.

---

# Performance Requirements

Core actions should preserve these constraints:

- no network request to open the Tracker
- no network request for IN / OUT
- no polling
- no continuously persisted timer
- minimal background execution
- minimal SQLite writes
- timestamp-derived durations
- lightweight screen hierarchy
- minimal dependencies
- no unnecessary animation framework
- no analytics SDK unless there is a concrete future requirement
- no advertising SDK
- no global state framework without a demonstrated need

Performance regressions in the Tracker should be treated as higher priority than most new features.

---

# Privacy Requirements

## Local by Default

Treatment data remains usable entirely on device.

## Optional Cloud

Cloud services enhance recovery but are not required for normal use.

## Data Minimization

Do not require treatment records to include information such as:

- legal name
- address
- phone number
- location
- orthodontist identity
- contacts
- advertising identifiers

unless a future feature has a clear product requirement for that information.

---

# Current MVP Success Criteria

The core MVP succeeds when a user can:

1. Install the app.
2. Configure treatment quickly.
3. Immediately see current tray progress.
4. Mark trays IN or OUT with one obvious action.
5. Trust tracked time after closing or restarting the app.
6. Change trays without destroying previous history.
7. Correct forgotten or incorrect IN/OUT history.
8. Review useful treatment statistics.
9. Review graphical progress.
10. Review historical treatment-plan versions.
11. Configure useful local reminders.
12. Use the core tracker without an account.
13. Use the core tracker without internet access.

The quality bar is not the number of features.

The quality bar is how **fast, reliable, useful, and frictionless** the tracker feels.

---

# Immediate Product Priority

The current priority is release hardening of the existing core.

Focus on:

- physical iPhone testing
- different supported iPhone screen sizes
- supported iOS versions where practical
- VoiceOver
- Dynamic Type
- dark mode
- reduced transparency
- keyboard behavior
- notification reliability
- database migration safety
- tracker mutation/race-condition testing
- preview-build daily use

Fix issues discovered through real use before expanding core scope.

---

# Post-MVP / Enhancement Roadmap

Potential enhancements should be handled as separately specified features rather than silently expanding MVP scope.

Currently planned or under consideration:

- Share Progress
- Siri / App Shortcuts
- Apple Watch companion
- selectable themes
- fuller Cloud Backup & Restore
- multi-device sync
- optional Support purchases
- additional statistics or graphs where they provide demonstrated utility

Each meaningful feature should have a corresponding specification in `docs/features/` before implementation.

Avoid introducing new infrastructure solely because a potential future feature might eventually need it.

---

# Architecture Guardrail

When evaluating a new feature:

1. Prefer using existing local architecture.
2. Add the smallest new dependency or subsystem that solves the actual requirement.
3. Keep SQLite authoritative wherever practical.
4. Keep normal tracker actions synchronous and local from the user's perspective.
5. Do not introduce cloud infrastructure, authentication requirements, background services, microservices, or complex state management unless the feature requires them.
6. Preserve existing behavior unless the product specification explicitly changes it.

Aligner Tracker should remain a small, focused tool even as useful capabilities are added.
