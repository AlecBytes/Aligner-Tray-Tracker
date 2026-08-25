# Statistics

## Status

Statistics V1 and the Statistics Graphs MVP are implemented after **Edit In/Out Times**.

This document is the source of truth for statistics behavior.

## Purpose

Provide a minimal, local-only summary of recorded aligner wear without making medical judgments.

Statistics compare recorded IN time only with the prescribed daily wear goal saved in the user's treatment-plan history.

## Entry Point

Add `Statistics` to the main menu as an active item.

Statistics is a read-only screen. It does not provide editing, export, sync, or treatment-plan history controls.

Add a `Graphs` entry near the top of Statistics. It opens a separate native list of
available graphs, followed by a separate graph-detail screen:

`Statistics -> Graphs -> Graph detail`

The Graphs list displays a title and short description for each graph. It does not load
statistics history or render chart previews.

## Graphs

### Shared Date Ranges

Every graph detail uses the same segmented range control and defaults to `7 Days`:

- `7 Days`: the current local calendar date and the six preceding local dates
- `30 Days`: the current local calendar date and the 29 preceding local dates
- `Treatment`: the complete treatment timeline beginning at the first
  `TrayPeriod.startedAt`

The 7- and 30-day ranges are clamped to treatment start. Their range start is local
midnight unless treatment began later on that first included date. Every range ends at
the detail screen's read time. Local-date calculations remain daylight-saving-time safe.

Changing the range recalculates from the snapshot already loaded by that detail screen.
Refocusing the detail screen reloads the SQLite source history and captures one new read
time. Graph data is not loaded or rendered on the main Statistics screen or Graphs list.

### Wear Time

Display daily recorded IN hours in chronological order as bars. A bar's color indicates
whether that day's prescribed goal was met, and an exact-value row for every day displays:

- local date
- recorded IN duration
- the prescribed goal selected for that historical treatment day
- `Goal met` or `Goal not met`

The exact rows are the accessible, non-color comparison between actual wear and the goal.
The chart does not imply medical effectiveness or adherence beyond that comparison.

### Goal Progress

Display each treatment day's signed difference between recorded IN duration and that
day's prescribed goal in chronological order. Bars at or above the zero reference line
mean the goal was met; bars below zero mean the recorded duration was short of the goal.
An exact-value row for every day displays the local date, recorded IN duration, historical
goal, and a formatted `Met by`, `Short by`, or `Goal met exactly` result.

### Tray Progress

Display elapsed time spent in every `TrayPeriod` that overlaps the selected range. Clip
each period to the selected range boundaries; the active period ends at the detail
screen's read time. Plot duration in elapsed 24-hour days and display the exact elapsed
duration and clipped start/end values in a row below the chart.

Repeated tray numbers remain distinct periods. Assign treatment-wide occurrence labels
in chronological order, such as `Tray 8 · Period 1` and `Tray 8 · Period 2`; periods whose
tray number occurs only once use `Tray 8`. The labels do not change when a shorter date
range hides an earlier occurrence.

### Graph Presentation

Use the native Expo UI Swift Charts component on iOS. Keep chronological charts
horizontally scrollable when their points exceed a readable viewport width, while exact
values remain in the screen's vertically scrolling native list. Provide loading, empty,
error, and retry states. Do not add chart interaction or previews.

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

The partial first day and partial current day are tracked days and are included in averages and goal counts. Their recorded IN and OUT durations are clipped to the actual tracked interval.

The first treatment day's prescribed daily goal is prorated by the portion of that local day remaining when treatment began. Its recorded IN time is compared with that fixed prorated goal, including while the first day is still in progress. The current partial day's goal is not prorated when it is a later treatment day.

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

IN and OUT averages are calculated as total duration in the requested range divided by its tracked-day count. Once the first treatment day is complete, its recorded IN and OUT durations are normalized to a full-local-day equivalent before contributing to summary averages. The normalization uses the ratio of the full local day's elapsed duration to the treatment-start-to-next-midnight duration, so daylight-saving transitions are handled without assuming a 24-hour day.

While the first treatment day is still in progress, its raw elapsed durations contribute to averages without normalization. Later partial days, including the current day and a later tray's start day, also contribute their raw elapsed durations. Recent Days always displays raw recorded durations rather than normalized summary values.

Display durations at minute precision in a clear form such as `21h 34m`, `42m`, or `0m`. Goal comparisons use the unrounded derived duration.

## Treatment-Plan Version Selection

Each treatment day has one prescribed goal for statistics.

Select the latest `TreatmentPlanVersion` whose `effectiveAt` is at or before the beginning of that treatment day's tracked portion. Break equal `effectiveAt` values by the greater version `id`.

For the first partial treatment day, the tracked portion begins at treatment start. For later days, it begins at local midnight. A plan edit made during a treatment day therefore affects statistics beginning with the next local treatment day. This avoids applying two daily goals to one calendar day.

Current Tray and Treatment Overall use the same goal for a given local treatment day, even when the current tray started partway through that day.

A day is goal-met when its derived IN duration for the relevant statistics range is greater than or equal to that day's goal converted to elapsed time. The first treatment day uses the prorated goal described above; later days use the selected plan's full `dailyWearGoalMinutes`. Statistics do not infer adherence, treatment effectiveness, or any other medical conclusion.

## Architecture and Persistence

SQLite remains the source of truth.

- Read `WearPunch`, `TrayPeriod`, and `TreatmentPlanVersion` history through a statistics repository/read-model layer.
- Keep raw SQLite out of React components.
- Use pure calculation and formatting functions where practical.
- Do not write calculated daily totals, averages, goal results, or other statistics to SQLite.
- Do not cache calculated statistics or graph data.
- Re-read source history whenever the Statistics screen gains focus so historical punch corrections are reflected automatically.
- Re-read source history whenever a graph detail screen gains focus. Range changes on an
  already-focused detail screen reuse its in-memory source snapshot.
- Do not require network access.

The repository may read the treatment history in a small number of bulk queries.
Statistics intentionally favor simple derived read models over a new schema or dependency.
The Graphs list itself performs no repository read. No graph data is persisted.

## UI

Keep the screen minimal and consistent with the existing app:

- three sections in the order Current Tray, Treatment Overall, Recent Days
- plain text/card rows using existing components and theme tokens
- a `Graphs` navigation row near the top of the screen
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
- 7-day, 30-day, and full-treatment graph ranges
- historical and prorated graph goals, exact-goal boundaries, and goal differences
- tray-period range clipping, active periods, stable ordering, and repeated tray labels

Use the project's existing test framework.

## Out of Scope

Do not add:

- CSV export
- cloud sync
- authentication
- a third-party charting dependency
- chart previews or chart interaction
- custom date ranges
- treatment-plan history UI
- medical judgments or recommendations
- persisted or cached statistics or graph data
- unrelated features
