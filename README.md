# Aligner Tracker

Aligner Tracker is a fast, local-first iPhone app for recording orthodontic
aligner wear. It keeps the everyday tracking workflow available offline and
derives wear time from timestamped IN/OUT events.

## What it does

- Tracks whether aligners are currently in or out
- Records tray changes and treatment-plan history
- Supports corrections to past IN/OUT events
- Shows local wear statistics and progress
- Schedules on-device wear and tray reminders
- Keeps normal tracking independent of accounts and network access
- Includes a foundation for optional paid color themes in a future release

## Status

The core iPhone tracker, treatment setup, tray history, event corrections,
statistics, notifications, help, and sharing flows are implemented. The app is
being prepared for its initial release. Version 1.0 is a free, local-only
release; paid features and Cloud Backup are explicitly excluded. Physical-device
release verification is still in progress.

The repository contains future cloud foundations, including Sign in with Apple,
manual backup, and empty-install restore, but they are disabled in production
1.0. SQLite remains the source of truth on the device, and multi-device
synchronization is not implemented. Android and web are not currently supported
product targets.

See the [App Store release plan](docs/app-store-release-plan.md) for the detailed
release-readiness assessment.

## Local-first by design

Treatment plans, tray history, and wear events are stored in SQLite on the
device. Normal tracker actions do not require a network connection, and elapsed
wear time is calculated from persisted timestamps rather than a continuously
stored timer.

Cloud backup is optional and does not replace the local database. The longer-term
cloud direction and unresolved synchronization decisions are documented
separately so they do not complicate the core offline workflow.

## Built with

- React Native and TypeScript
- Expo SDK 57 and Expo Router
- Expo UI SwiftUI for app-owned iOS interfaces
- SQLite for on-device persistence
- Expo Notifications for local reminders
- Optional Supabase backup and RevenueCat paid access integrations

## Quick start

Requires Node.js 22.13.0 (see [`.nvmrc`](.nvmrc)) and npm.

```sh
nvm use
npm install
npm start
```

`npm start` is the canonical development command. For device builds, WSL tunnel
setup, validation commands, build variants, and purchase testing, see the
[development guide](docs/development.md).

## Documentation

- [Development guide](docs/development.md) — local setup, commands, device builds,
  and integration testing
- [MVP plan](docs/mvp-plan.md) — product goals and architecture direction
- [Planner context](docs/planner-context.md) — current cross-feature decisions and
  priorities
- [Performance](docs/performance.md) — performance budgets and measurement plan
- [SQLite transactions](docs/sqlite-transactions.md) — mutation and transaction
  policy
- [Feature specifications](docs/features/) — implemented behavior, requirements,
  and future decisions
- [Cloud Backup & Restore](docs/features/cloud-backup-restore.md) — cloud scope and
  phased implementation
- [Future cloud sync](docs/features/cloud-sync-future.md) — constraints and
  unresolved synchronization decisions
- [Paid access](docs/features/paid-access.md) — commercial and entitlement contract
- [App Store release plan](docs/app-store-release-plan.md) — release scope,
  verification, and remaining work
