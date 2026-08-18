# Statistics V1

## Status

Implemented after **Edit In/Out Times**.

This document is the source of truth for Statistics V1.

## Purpose

Provide a minimal, local-only summary of recorded aligner wear without making medical judgments.

Statistics compare recorded IN time only with the prescribed daily wear goal saved in the user's treatment-plan history.

## Entry Point

Add `Statistics` to the main menu as an active item.

Statistics is a read-only screen. It does not provide editing, export, sync, or treatment-plan history controls.

## Display

### Current Tray

Display statistics for the active `TrayPeriod` only. A previous period with the same tray number is not combined with the active period.

- Days worn
- Average IN time per tracked day
- Average OUT time per tracked day
- Days meeting the prescribed daily wear goal / tracked days

### Treatment Overall

Display statistics from the first `TrayPeriod.startedAt` through the time the screen's data was read.

- Average IN time per tracked day
- Average OUT time per tracked day
- Days meeting the prescribed daily wear goal / tracked days

### Recent Days

Display up to the last seven treatment days, newest first.

For each day, display:

- local date
- IN time
- OUT time
- whether the prescribed wear-hours goal for that day was met

Do not display calendar dates before treatment began.

## Treatment-Day Definition

A treatment day is a local calendar date that intersects the treatment timeline.

- The first treatment day begins at the first `TrayPeriod.startedAt`, not at midnight.
- The current treatment day ends at the read time, not at the next midnight.
- All intervening treatment days use local midnight-to-midnight boundaries.
- Local calendar-day iteration must remain correct across daylight-saving time changes; do not assume every local day is exactly 24 elapsed hours.
- V1 groups timestamps using the device's local time zone at read time because the current data model does not persist a historical time zone.

The partial first day and partial current day are tracked days and are included in averages and goal counts. Their IN and OUT durations are clipped to the actual tracked interval.

The prescribed daily goal is not prorated for a partial day. A partial day is goal-met only if its recorded IN time reaches the full prescribed daily goal.

For Current Tray, each local date intersecting the active `TrayPeriod` is a tracked day. This includes a partial tray-start day and the current partial day. `Days worn` is this tracked-day count.

## Duration Calculation

Derive wear intervals from the ordered `WearPunch` timeline. Order punches by `timestamp`, then by `id` for deterministic handling of equal timestamps at tray changes.

For each reported window:

- a punch sets the state from its timestamp until the next punch
- a state established on an earlier day continues across midnight until another punch changes it
- a window beginning between punches inherits the most recent earlier state
- do not count time before treatment began or after the read time
- Current Tray calculations are additionally clipped to the active `TrayPeriod.startedAt`
- Treatment Overall and Recent Days include all tray periods in the treatment timeline

IN and OUT averages are calculated as total recorded duration in the requested range divided by its tracked-day count. Averages include partial tracked days.

Display durations at minute precision in a clear form such as `21h 34m`, `42m`, or `0m`. Goal comparisons use the unrounded derived duration.

## Treatment-Plan Version Selection

Each treatment day has one prescribed goal for statistics.

Select the latest `TreatmentPlanVersion` whose `effectiveAt` is at or before the beginning of that treatment day's tracked portion. Break equal `effectiveAt` values by the greater version `id`.

For the first partial treatment day, the tracked portion begins at treatment start. For later days, it begins at local midnight. A plan edit made during a treatment day therefore affects statistics beginning with the next local treatment day. This avoids applying two daily goals to one calendar day.

Current Tray and Treatment Overall use the same goal for a given local treatment day, even when the current tray started partway through that day.

A day is goal-met when its derived IN duration for the relevant statistics range is greater than or equal to that day's selected `dailyWearGoalMinutes` converted to elapsed time. Statistics do not infer adherence, treatment effectiveness, or any other medical conclusion.

## Architecture and Persistence

SQLite remains the source of truth.

- Read `WearPunch`, `TrayPeriod`, and `TreatmentPlanVersion` history through a statistics repository/read-model layer.
- Keep raw SQLite out of React components.
- Use pure calculation and formatting functions where practical.
- Do not write calculated daily totals, averages, goal results, or other statistics to SQLite.
- Do not cache calculated statistics in V1.
- Re-read source history whenever the Statistics screen gains focus so historical punch corrections are reflected automatically.
- Do not require network access.

The repository may read the treatment history in a small number of bulk queries. V1 intentionally favors a simple derived read model over a new schema or dependency.

## UI

Keep the screen minimal and consistent with the existing app:

- three sections in the order Current Tray, Treatment Overall, Recent Days
- plain text/card rows using existing components and theme tokens
- no graphs or charts
- clear loading, empty, error, and retry states

The screen does not need a continuously persisted or background timer. A newly focused screen must calculate through its current read time.

## Tests

Add focused tests for:

- current tray statistics
- overall treatment statistics
- multiple tray periods
- treatment-plan changes over time
- goal-met calculations using the plan effective for that day
- partial first and current days
- wear periods crossing midnight
- corrected punches affecting recalculated results
- days with no state changes but a continuing IN or OUT state
- repository mapping of `WearPunch`, `TrayPeriod`, and `TreatmentPlanVersion` history

Use the project's existing test framework.

## Out of Scope

Do not add:

- CSV export
- cloud sync
- authentication
- charts, graphs, or a charting dependency
- treatment-plan history UI
- medical judgments or recommendations
- persisted or cached statistics
- unrelated features
