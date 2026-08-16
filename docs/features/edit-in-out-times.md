# Edit In/Out Times

## Purpose

Allow users to correct recorded aligner IN/OUT history while preserving a valid, alternating wear-state timeline.

This feature should remain minimal, local-first, and performance-focused.

## Entry Point

Add a menu item:

`Edit In/Out Times`

Navigation flow:

```text
Menu
└── Edit In/Out Times
      ↓
Date History
      ↓
Day
      ↓
IN/OUT Events
      ↓
Edit Event
```

## Date History Screen

Show the days of the **current treatment week** first, with **today at the top**.

Example:

```text
Edit In/Out Times

Today — Sun, Aug 16
Sat, Aug 15
Fri, Aug 14
Thu, Aug 13
...

Previous Weeks

Week 2 — Aug 3–Aug 9
Week 1 — Jul 27–Aug 2
```

Previous treatment weeks should appear as one collapsed item per week.

Tapping a previous week expands it and reveals the individual days in that week.

Selecting any day opens that day's punch history.

### Treatment Week Definition

Weeks are based on the treatment timeline rather than generic calendar-week numbering.

The exact display format may be adapted to fit the existing UI, but it should remain compact and easy to scan.

## Daily Punch History Screen

Show all IN/OUT events for the selected day in chronological order.

Example:

```text
Sunday, Aug 16

8:02 AM     IN
12:14 PM    OUT
12:47 PM    IN
6:31 PM     OUT
7:06 PM     IN

+ Add Missing Time
```

Selecting an event opens the Edit Event screen.

## Edit Event Screen

An existing punch may have its timestamp corrected.

### Editable

- Date/time, subject to validation.

### Read-only

- IN/OUT status.

Do not allow the user to directly change an existing event from IN to OUT or from OUT to IN.

### Validation

The edited timestamp must:

- remain within its associated `TrayPeriod`
- remain after the preceding punch, if one exists
- remain before the following punch, if one exists
- preserve a valid alternating IN/OUT timeline

Reject invalid changes rather than automatically rewriting surrounding history.

## Timeline Invariant

The wear-state timeline must always alternate.

Valid:

```text
IN → OUT → IN → OUT → IN
```

Also valid when the relevant history begins while trays are already OUT:

```text
OUT → IN → OUT → IN
```

Invalid:

```text
IN → IN
OUT → OUT
```

The data layer must preserve this invariant after every correction.

## Add Missing Time

Do not expose raw database-oriented actions such as:

- Add IN Punch
- Add OUT Punch

Instead provide:

`Add Missing Time`

The user chooses:

- `Trays were OUT`
- `Trays were IN`

Then supplies:

- start date/time
- end date/time

The application should create the required pair of state transitions atomically.

Example: if trays were incorrectly considered IN during the selected period, adding an OUT period creates:

```text
12:00 PM   OUT
12:30 PM   IN
```

### Missing-Time Validation

The requested period must:

- have an end later than its start
- fit within the appropriate `TrayPeriod`
- not overlap an incompatible existing period
- preserve the alternating state timeline before and after the inserted period

If the correction cannot be represented safely, reject it with a concise useful message.

## Deletion

Arbitrary deletion of a single `WearPunch` is **not part of the initial version** of this feature.

Deleting a single transition can easily create invalid state such as:

```text
IN → IN
```

A future enhancement may support removing an entire recorded IN or OUT period atomically.

Do not implement single-punch deletion unless the feature specification is explicitly revised.

## Tray-Period Boundaries

Corrections must not silently move events across tray-change boundaries.

A `WearPunch` remains associated with its `TrayPeriod`.

For this version:

- an existing punch cannot be moved outside its current `TrayPeriod`
- missing periods must fit within a valid tray period
- tray history itself is not edited from this feature

## Current State After Correction

The current IN/OUT status is always derived from persisted punch history.

If the latest relevant punch is corrected, the tracker must reflect the corrected timeline after the operation succeeds.

Do not maintain a separate conflicting current-state value.

## Calculated Totals

Daily IN/OUT totals remain derived values.

After a correction:

- today's tracker totals should update from the corrected timeline
- corrections to previous days should automatically affect historical calculations when those views are added
- no accumulated daily totals should be written solely to support corrections

## Persistence

SQLite remains the source of truth.

Requirements:

- keep raw SQL out of React components
- use the existing repository/application-layer pattern
- use parameterized queries
- use transactions for multi-step corrections
- if a correction fails, preserve the previously valid persisted state

## Performance

Maintain the project's performance-first philosophy.

Avoid:

- unnecessary dependencies
- network access
- background processing
- complex global state
- reprocessing more history than is required for the selected day/week

## Tests

Add focused tests for:

- editing a punch timestamp
- rejecting a timestamp before the previous punch
- rejecting a timestamp after the next punch
- rejecting a timestamp outside the tray period
- adding a missing OUT period
- adding a missing IN period
- preserving IN/OUT alternation
- corrections on previous days
- corrections that cross midnight
- corrections near tray-change boundaries
- failed multi-step correction preserving prior data

Use the project's existing test framework.

## Out of Scope

Do not implement as part of this feature:

- statistics
- treatment-plan history UI
- authentication
- cloud sync
- backend/API
- CSV export
- arbitrary single-punch deletion
