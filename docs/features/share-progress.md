# Share Progress

## Status

Implemented on iOS.

This document is the source of truth for Share Progress behavior.

## Purpose

Allow users to quickly share a useful plain-text snapshot of their aligner progress without requiring an account, network connection, export workflow, or custom messaging UI.

The feature should remain lightweight and local-first.

It is intended for situations such as:

- sending a quick progress update to a friend or family member
- sharing a more useful summary with another person
- providing a reasonably detailed text overview to an orthodontist or dentist

Share Progress is not a medical report, formal export system, or communication platform.

## Entry Point

Add **Share Progress** to the main menu.

Flow:

```text
Menu
  ↓
Share Progress
  ↓
Choose content level
  ↓
Preview
  ↓
Share
  ↓
Native iOS share sheet
```

Do not call the menu item simply `Share`, because that could ambiguously refer to sharing the application itself.

## Content Levels

Provide three selectable content levels:

1. `Brief`
2. `Summary`
3. `Detailed`

`Summary` is selected by default.

Use a native segmented control or equivalent compact Expo UI / SwiftUI selection control.

Changing the selected level updates the preview from the already-loaded data snapshot and must not trigger another SQLite read.

## Brief

Brief is intended for quick casual sharing.

Include:

- current tray number / total trays
- current tray day
- today's recorded IN time

Example:

```text
Aligner progress: Tray 9 of 48, Day 5.
20h 17m IN today.
```

Do not include:

- OUT time
- averages
- goal counts
- treatment-plan details
- recent-day history

## Summary

Summary is the default and should provide the most generally useful balance of detail and brevity.

Include:

- current tray number / total trays
- current tray day
- today's IN time
- today's OUT time
- prescribed daily wear goal
- current-tray average IN time per tracked day
- current-tray goal-met days / tracked days

Example:

```text
Aligner Tracker

Current tray: 9 of 48
Tray day: 5
Today: 20h 17m IN, 1h 42m OUT
Daily goal: 22h

Current tray average: 21h 31m IN/day
Goal met: 4 of 5 tracked days
```

Use the same definitions of tracked days, current tray, daily goals, and average IN time as Statistics.

## Detailed

Detailed provides a fuller text snapshot while remaining readable in email or messaging apps.

Include the following sections.

### Current Treatment

- current tray number / total trays
- current tray day
- prescribed days per tray
- prescribed daily wear goal

### Today

- IN time
- OUT time

### Current Tray

- average IN time per tracked day
- average OUT time per tracked day
- goal-met days / tracked days

### Treatment Overall

- average IN time per tracked day
- average OUT time per tracked day
- goal-met days / tracked days

### Recent Days

Include up to the seven most recent treatment days, newest first.

For each day display:

- local date
- recorded IN time
- recorded OUT time
- goal status

Example:

```text
Aligner Tracker Progress

CURRENT TREATMENT
Tray: 9 of 48
Tray day: 5
Schedule: 7 days/tray
Daily wear goal: 22h

TODAY
IN: 20h 17m
OUT: 1h 42m

CURRENT TRAY
Average IN: 21h 31m/day
Average OUT: 2h 29m/day
Goal met: 4 of 5 tracked days

TREATMENT OVERALL
Average IN: 21h 18m/day
Average OUT: 2h 42m/day
Goal met: 61 of 73 tracked days

RECENT DAYS
Aug 26 — 20h 17m IN / 1h 42m OUT — In progress
Aug 25 — 22h 11m IN / 1h 49m OUT — Goal met
Aug 24 — 21h 46m IN / 2h 14m OUT — Goal not met
```

The exact formatting may adapt slightly for readability, but the data content and semantics must remain consistent with this specification.

## Current-Day Goal Status

The current treatment day may still be incomplete when the user shares progress.

Do not label the current incomplete treatment day `Goal not met`, even if its current recorded IN duration has not yet reached the prescribed goal.

Display:

```text
In progress
```

This avoids presenting an unfinished day as a completed failure.

This is a Share Progress presentation rule only.

It must not change Statistics calculation or display behavior.

Completed historical days continue to display:

- `Goal met`
- `Goal not met`

according to the existing Statistics goal rules.

## Data Semantics

Share Progress must reuse the same domain definitions as Statistics.

Do not create separate definitions for:

- tracked days
- treatment days
- current tray statistics
- treatment-overall statistics
- recent days
- IN/OUT duration calculation
- historical treatment-plan goal selection
- partial first treatment days
- repeated tray periods
- daylight-saving-time handling

Where practical, reuse the existing Statistics read model and pure calculation logic rather than copying its calculations into Share-specific code.

Share-specific logic should primarily transform calculated data into human-readable text.

## Data Snapshot

When Share Progress gains focus:

1. read the required local source data
2. capture a single read time
3. derive the required statistics
4. build an in-memory share snapshot

Use this same snapshot for:

- Brief preview
- Summary preview
- Detailed preview
- the final text passed to the system share sheet

Changing content levels must not trigger another database read.

If the user leaves Share Progress and later returns, reload the source data and create a new snapshot.

The screen does not need a once-per-second timer.

## Preview

Display the exact text that will be sent to the native share sheet.

The preview should:

- update immediately when the user changes content level
- be readable and selectable if the available Expo UI behavior supports it naturally
- reflect the same formatter output passed to the share action

Do not maintain separate preview and share formatting implementations.

## Sharing

Provide one primary action:

```text
Share
```

Tapping Share opens the native iOS share sheet with the currently previewed plain text.

The app should not implement separate buttons for:

- Messages
- Mail
- Copy
- Notes
- third-party messaging apps

The operating system determines the available share destinations.

Do not build an app-owned email or messaging composer.

## Architecture

SQLite remains the source of truth.

Recommended flow:

```text
SQLite source data
      ↓
existing statistics/read-model calculations
      ↓
Share Progress snapshot
      ↓
pure text formatter
      ↓
native iOS share sheet
```

Prefer pure functions for generating the three text formats.

Conceptually:

```text
formatBriefShare(snapshot)
formatSummaryShare(snapshot)
formatDetailedShare(snapshot)
```

The exact naming and module layout may follow existing repository conventions.

Keep raw SQLite access out of React components.

## Persistence

Do not persist:

- generated share text
- selected share destination
- share history
- share timestamps
- previously generated snapshots

No new SQLite table is required.

The selected content level does not need to persist between app launches for V1.

`Summary` should remain the default whenever the screen opens.

## Network and Accounts

Share Progress must work without:

- an account
- authentication
- Supabase
- network access
- cloud backup
- multi-device sync

Generating the share content must remain entirely local.

The destination application selected in the iOS share sheet may independently use the network, but that behavior is outside Aligner Tracker.

## Privacy

Sharing is always initiated explicitly by the user.

Do not automatically:

- upload progress
- select a recipient
- save recipients
- access contacts
- transmit analytics about share destinations
- send anything when the screen opens

The preview makes the exact content visible before the user invokes the system share sheet.

## iOS UI

The visible Share Progress screen must follow the project's Expo UI / SwiftUI rules.

Use native Expo UI controls for:

- content-level selection
- text
- layout
- primary Share button
- loading/error states

Opening the operating-system share sheet is platform behavior rather than app-owned visible React Native UI.

Use the smallest appropriate platform API for invoking it.

Do not add a third-party sharing dependency unless the available platform APIs cannot satisfy this feature.

## Loading and Error States

Provide a minimal loading state while the local snapshot is being created.

If required local data cannot be loaded:

- show a clear local-data error
- provide Retry
- do not open the share sheet with incomplete or fabricated data

If there is no active treatment, follow the app's existing treatment/setup route behavior rather than creating Share-specific treatment setup semantics.

## Formatting

Use human-readable minute precision consistent with Statistics.

Examples:

```text
21h 34m
42m
0m
```

Do not include seconds in shared summaries.

Use device-local calendar dates consistent with Statistics.

Keep output plain text.

Do not depend on Markdown rendering by destination apps.

Section headings in Detailed content may use plain uppercase text or other simple text conventions that survive across share destinations.

## Performance

This is not a core tracker action, but it should remain lightweight.

- no network request
- no polling
- no background timer
- no persisted derived values
- no repeated SQLite reads while switching content levels
- reuse existing bulk statistics reads/calculations where practical
- avoid new dependencies solely for text sharing

Do not introduce caching or new database structures solely for this feature unless profiling demonstrates a real need.

## Tests

Add focused tests for the pure share formatters.

Cover:

- Brief content
- Summary content
- Detailed content
- current tray / total trays
- current tray day
- today's IN/OUT values
- prescribed goal
- current-tray statistics
- treatment-overall statistics
- fewer than seven historical days
- seven recent days
- current day displayed as `In progress`
- completed goal-met day
- completed goal-not-met day
- repeated tray periods relying on Statistics semantics
- treatment-plan changes relying on Statistics semantics
- duration formatting
- empty/error repository states where appropriate

Do not duplicate all Statistics calculation tests in Share Progress.

Statistics remains responsible for validating the underlying domain calculations.

Share Progress tests should primarily verify snapshot mapping and generated text.

## Out of Scope

Do not add:

- CSV export
- PDF generation
- image or branded share cards
- screenshots
- raw WearPunch timelines
- custom date ranges
- user-editable share templates
- saved templates
- saved share history
- contact integration
- orthodontist profiles
- automatic recipient selection
- app referral links
- direct email sending
- direct SMS sending
- cloud sharing
- share analytics
- social features
- medical assessments or recommendations

These can be considered separately if a later feature has a concrete user need.

## Success Criteria

Share Progress succeeds when a user can:

1. Open Share Progress from the menu.
2. Immediately see a useful Summary preview.
3. Switch between Brief, Summary, and Detailed without another database load.
4. Know exactly what information is about to be shared.
5. Tap Share once.
6. Choose any available destination from the native iOS share sheet.
7. Complete the entire flow without an account or network dependency inside Aligner Tracker.
