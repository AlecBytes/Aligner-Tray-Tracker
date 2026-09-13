# Retainer Mode

## Purpose

Keep Aligner Tracker useful after active aligner treatment is complete.

Retainer Mode is a distinct post-treatment mode focused on two core jobs:

1. remind the user to put retainers in at night and remove them in the morning
2. track retainer wear time with the same local, timestamp-based reliability as active aligner tracking

Retainer Mode must remain local-first, fast, and usable without an account or network connection.

## Product Positioning

Retainer Mode is not another treatment-plan version and it must not simulate retainers as a fake tray.

The app has two mutually exclusive tracking modes:

- **Active Treatment** — tray progression, tray days, IN/OUT tracking, tray-change reminders, and OUT-too-long reminders
- **Retainer Mode** — nighttime retainer reminders and retainer IN/OUT wear tracking

A user explicitly chooses when active treatment is complete by enabling Retainer Mode.

## Entry Point

Add a main-menu item:

`Retainer Mode`

The item opens a single Retainer Mode settings screen.

## Retainer Mode Screen

Show a concise description at the top:

> Retainer Mode is for after active aligner treatment is complete. It replaces tray progression with nighttime retainer reminders and wear tracking.

Primary control:

- `Retainer Mode` enabled / disabled

Retainer settings should remain visible on this screen so the feature is understandable at a glance. When Retainer Mode is disabled, the settings are read-only/disabled.

### Settings

#### Bedtime Reminder

Controls:

- enabled / disabled
- reminder time

Recommended default:

- enabled
- 10:00 PM local time

Purpose:

Remind the user to physically put in their retainers when they are still OUT.

Suggested notification:

`Time to put in your retainers.`

#### Morning Reminder

Controls:

- enabled / disabled
- reminder time

Recommended default:

- enabled
- 7:00 AM local time

Purpose:

Remind the user to physically remove their retainers when they are still IN.

Suggested notification:

`Good morning — remember to take out your retainers and mark them OUT.`

#### Automatic Morning OUT

Controls:

- `Automatically mark retainers OUT` enabled / disabled
- automatic OUT time

Recommended default:

- disabled
- 7:00 AM local time

Supporting copy:

> Assume retainers are OUT at this time if they are still marked IN.

This is intentionally described as an assumption. The app does not detect whether the retainers were physically removed.

The automatic OUT time is independent from the Morning Reminder time.

## Enabling Retainer Mode

Retainer Mode can be enabled only while there is an active treatment.

When the user turns the toggle ON, do not immediately change state. Present a confirmation:

### Confirmation

Title:

`Complete current treatment?`

Message:

> Turning on Retainer Mode will complete your current treatment plan and switch the tracker to nighttime retainer tracking. Your treatment history will be preserved.

Actions:

- `Cancel`
- `Complete Treatment & Enable`

### Confirmed Enable Behavior

On confirmation:

1. Capture one completion timestamp.
2. If the active aligners are currently IN, record an OUT punch at that timestamp so the active-treatment timeline is closed accurately.
3. End the active `TrayPeriod` at that timestamp.
4. Mark the current `Treatment` as completed at that timestamp.
5. Preserve all treatment-plan versions, tray periods, punches, corrections, and historical data.
6. Create/start the Retainer Mode period associated with the completed treatment.
7. Begin Retainer Mode in the OUT state.
8. Cancel active-treatment OUT-too-long, tray-change, and overdue tray-change notifications.
9. Schedule/reconcile Retainer Mode notifications from the user's current retainer settings.
10. Route to the Retainer Tracker.

Do not automatically enable Retainer Mode merely because the user reaches the final planned tray or planned final day. Completing treatment is always an explicit user action.

## Disabling Retainer Mode

Turning Retainer Mode OFF means the user is leaving the post-treatment state and intends to begin a new active treatment plan, such as a refinement treatment.

Do not reactivate or reopen the previously completed treatment.

When the user turns the toggle OFF, do not immediately change state. Present a confirmation:

### Confirmation

Title:

`Leave Retainer Mode?`

Message:

> You'll return to Treatment Setup to begin a new treatment plan. Your previous treatment and retainer history will be preserved.

Actions:

- `Cancel`
- `Turn Off & Set Up Treatment`

### Confirmed Disable Behavior

On confirmation:

1. Capture one completion timestamp for leaving Retainer Mode.
2. If retainers are currently IN, record an OUT punch at that timestamp so the retainer wear timeline is closed.
3. End the active Retainer Mode period at that timestamp.
4. Cancel pending Retainer Mode notifications.
5. Preserve all completed treatment and retainer history.
6. Disable Retainer Mode.
7. Route directly to Treatment Setup.

The app is then in the same no-active-treatment state used before initial treatment setup.

Completing Treatment Setup must create a **new `Treatment`**, not a new `TreatmentPlanVersion` on the completed treatment.

If the user leaves Treatment Setup without completing it, the app remains in the no-active-treatment/setup-required state. The completed treatment and retainer history remain intact.

## Treatment Lifecycle

Retainer Mode introduces an explicit treatment lifecycle:

```text
Treatment 1
  -> completed
  -> Retainer Period 1
  -> Retainer Mode disabled
  -> Treatment Setup
  -> Treatment 2
  -> completed
  -> Retainer Period 2
```

A second treatment can represent refinements or another later course of aligner treatment.

### Completed Treatments

A completed treatment is historical and must not be silently reopened or mutated into a new course of treatment.

Persist treatment completion explicitly, such as with a nullable `CompletedAt` value or an equivalent explicit lifecycle field. Do not infer treatment completion only from the absence of an active `TrayPeriod`.

Existing history screens and statistics should continue to preserve the completed treatment's historical values.

## Retainer Tracker

While Retainer Mode is active, the main tracker changes from tray progression to retainer wear tracking.

Hide/remove active-treatment-only content:

- current tray number / total trays
- current tray day
- days remaining
- Change Tray
- active Treatment Plan editing

The main interaction remains one large IN/OUT control so the workflow stays familiar.

### Retainers OUT

Recommended content:

```text
RETAINER MODE

Retainers are OUT

[ RETAINERS ARE OUT ]
  Tap when inserted

Last wear
8h 06m

Next reminder
10:00 PM
```

### Retainers IN

Recommended content:

```text
RETAINER MODE

Retainers are IN
8:14:32

[ RETAINERS ARE IN ]
  Tap when removed

Morning reminder
7:00 AM
```

The exact visual styling should follow the established iOS Expo UI / SwiftUI direction. The large state toggle remains the dominant interaction.

## Retainer Wear Tracking

Retainer wear uses timestamped state transitions rather than a continuously persisted timer.

States:

```text
IN
OUT
```

Example:

```text
10:18 PM  IN
 6:47 AM  OUT
```

Wear duration is derived from timestamps.

A session may cross midnight without special handling; duration is still calculated from the IN and OUT timestamps.

Multiple IN/OUT transitions are valid. For example, the user may briefly remove retainers during the night and put them back in.

The visible timer may update while the Retainer Tracker is active, but the app must not persist elapsed time continuously.

When OUT, V1 should show the duration of the most recently completed wear session as `Last wear`. More advanced nightly aggregation belongs to later statistics work.

## Manual IN / OUT Behavior

### OUT -> IN

When the user taps to mark retainers IN:

1. insert an IN retainer wear punch with the current timestamp
2. update the UI immediately from local state
3. cancel the pending bedtime reminder for that night when applicable
4. schedule/reconcile the next morning reminder when enabled

### IN -> OUT

When the user taps to mark retainers OUT:

1. insert an OUT retainer wear punch with the current timestamp
2. update the UI immediately from local state
3. cancel any pending morning reminder for the current wear session
4. schedule/reconcile the next bedtime reminder when enabled

Notification API failure must not roll back a successfully committed wear punch.

## Bedtime Reminder Behavior

The Bedtime Reminder is intended to remind the user to physically insert retainers.

When enabled:

- schedule the next local reminder at the configured bedtime while retainers are OUT
- if the user marks retainers IN before that reminder, cancel the obsolete reminder
- after the user later marks retainers OUT, schedule/reconcile the next appropriate bedtime reminder
- do not fire an immediate catch-up notification when the configured time has already passed

The reminder should recur through bounded local scheduling/reconciliation rather than polling or server infrastructure.

Message:

`Time to put in your retainers.`

## Morning Reminder Behavior

The Morning Reminder is intended to remind the user to physically remove retainers.

When enabled:

- after retainers are marked IN, schedule the next applicable local morning reminder
- if the user marks retainers OUT before the reminder, cancel the obsolete reminder
- if the retainers remain IN, allow the reminder to fire at the configured time
- do not fire an immediate catch-up notification when the configured time has already passed

Message:

`Good morning — remember to take out your retainers and mark them OUT.`

The Morning Reminder remains useful even when Automatic Morning OUT is enabled because automatic OUT changes the app's assumed tracking state; it does not confirm physical removal.

## Automatic Morning OUT Behavior

Automatic Morning OUT is optional and defaults OFF.

When enabled, the app should treat the configured local time as an assumed OUT timestamp when the overnight retainer state is still IN.

### Foreground Behavior

If the app is active when the configured time is reached and:

- retainers are currently IN
- the current IN punch occurred before that day's automatic OUT time
- no later OUT punch exists

record one OUT punch at the configured automatic OUT timestamp.

### Closed / Suspended App Behavior

Do not depend on background JavaScript execution or a continuously running timer.

On the next app startup or resume after the configured time, reconcile the retainer state. If the qualifying IN punch began before that automatic OUT timestamp and no OUT followed it, insert one OUT punch using the configured automatic OUT timestamp, not the startup/resume time.

Example:

```text
10:24 PM  IN
7:00 AM   configured automatic OUT
8:13 AM   app opened
```

Persisted result:

```text
10:24 PM  IN
7:00 AM   OUT
```

Do not create an 8:13 AM OUT punch.

### Guardrails

- never create a duplicate automatic OUT punch
- never overwrite or replace an earlier manual OUT punch
- do not automatically OUT an IN punch that was created after the configured automatic OUT time
- changing the setting must not rewrite already completed wear history
- disabling Automatic Morning OUT leaves the current state unchanged

This feature is an explicit user-selected assumption and should be described that way in the UI.

## Notification Settings Changes

Retainer reminder controls live on the Retainer Mode screen in V1 rather than being added to the general Notifications screen.

When a retainer reminder is disabled:

- cancel its pending notification(s)
- keep the saved reminder time

When enabled or when its time changes:

- cancel obsolete requests
- recalculate the next applicable future reminder from the current Retainer Mode state
- do not deliver missed reminders immediately

Changing Automatic Morning OUT settings should reconcile only the relevant retainer state. It must not modify completed sessions.

## Notification Permission and Sound

Retainer reminders use local notifications only.

Use the same notification-permission behavior and normal device notification sound policy as the existing treatment reminders.

If notification permission is denied:

- retain the user's reminder preferences
- show a concise blocked/permission status when appropriate
- do not block Retainer Mode or manual wear tracking
- do not introduce push notifications or server infrastructure

## Persistence / Domain Model

Keep active aligner history and retainer history semantically separate.

Recommended conceptual additions:

```text
Treatment
---------
...
CompletedAt   nullable

RetainerPeriod
--------------
Id
TreatmentId
StartedAt
EndedAt       nullable

RetainerWearPunch
-----------------
Id
RetainerPeriodId
Status        IN | OUT
Timestamp
```

Retainer settings remain local settings and should include at least:

- Retainer Mode enabled/current-state information as required by the final schema
- bedtime reminder enabled
- bedtime reminder local time
- morning reminder enabled
- morning reminder local time
- automatic morning OUT enabled
- automatic morning OUT local time

Use a proper SQLite migration. Do not recreate the database.

The exact repository/service split should follow existing project conventions, but normal tracker UI should not query raw SQL directly.

### Why Separate Retainer Punches

The existing `WearPunch` belongs to a `TrayPeriod`. Retainer tracking must not create a fake tray or weaken the established active-treatment tray-period invariant.

A dedicated Retainer Mode period and retainer punch timeline keeps completed aligner treatment immutable and makes later refinement treatments unambiguous.

## Current Mode Resolution

At startup, the app should resolve one of three local states:

1. active treatment -> Active Treatment Tracker
2. active retainer period -> Retainer Tracker
3. neither -> Treatment Setup

This resolution must be local and deterministic.

There must never be both an active `TrayPeriod` and an active `RetainerPeriod` at the same time.

There must never be more than one active `RetainerPeriod`.

## Edit In/Out Times

Retainer punches should eventually be correctable through the same user-facing concept as `Edit In/Out Times`, while preserving retainer history separately from active treatment punches.

For Retainer Mode V1, implementation may defer the correction UI if that would materially expand scope, but the stored timestamp model must not prevent later corrections.

Automatic Morning OUT punches are ordinary historical retainer OUT events after creation and should be correctable when retainer correction UI is added.

## Statistics

Do not require a new statistics dashboard for Retainer Mode V1.

Core V1 display is limited to:

- current IN session duration while retainers are IN
- most recent completed wear-session duration while retainers are OUT

Potential later Retainer Mode statistics:

- average nightly wear
- total tracked nights
- recent-night history
- nights meeting a configurable goal

Do not add streaks, badges, scores, or engagement mechanics.

## Treatment History

Enabling Retainer Mode preserves the completed treatment.

Disabling Retainer Mode preserves:

- the completed treatment
- its treatment-plan versions
- tray periods
- active-treatment wear punches
- the Retainer Mode period
- retainer wear punches

Starting a new treatment must not overwrite any of these records.

If treatment-history UI does not yet support multiple completed treatments at implementation time, preserve the data first and extend the UI separately as needed. Do not flatten multiple treatments into one plan-version history.

## Backup Compatibility

Retainer Mode must not require cloud backup.

If Cloud Backup & Restore is enabled when this feature is implemented, new backups should include the treatment completion state, retainer periods, retainer punches, and retainer settings needed to restore the same local mode and history.

Older backups that predate Retainer Mode must remain restorable using existing defaults and should not invent retainer history.

Do not put any network request on the Retainer Tracker's IN/OUT action path.

## Failure Behavior

Core tracking remains authoritative even if reminder scheduling fails.

Examples:

- a successful retainer IN/OUT SQLite write remains committed if the OS notification API fails
- enabling Retainer Mode must not lose completed treatment data if notification scheduling fails
- disabling Retainer Mode must preserve completed history even if notification cancellation fails
- app startup must still resolve the correct local mode without network access

Use transactions for lifecycle changes that modify multiple related records.

## Performance

Retainer Mode should preserve the existing performance-first architecture.

Avoid:

- network requests on core actions
- polling
- continuous background timers
- continuously persisted elapsed time
- background services solely for Automatic Morning OUT
- duplicate notification scheduling
- unnecessary dependencies
- recalculating unrelated historical data on each timer tick

Persist timestamps and derive elapsed time.

## Accessibility / Native UI

Use the established Expo UI / SwiftUI iOS direction.

The mode toggle and confirmation dialogs should use native controls and clear accessibility labels.

Do not rely on color alone to distinguish IN from OUT.

Retainer reminder times should use native time-picking controls.

## Acceptance Checks

### Enable Flow

- Retainer Mode appears as a menu item during active treatment.
- The screen explains that the mode is for post-treatment retainer wear.
- Turning the toggle ON always asks for confirmation.
- Cancel leaves the active treatment unchanged.
- Confirming closes an active IN state with an OUT timestamp when needed.
- Confirming ends the active tray period and marks the treatment completed.
- Existing treatment history is preserved.
- Active-treatment reminders are canceled.
- Retainer Mode starts OUT and routes to the Retainer Tracker.
- Reaching the final tray alone never enables Retainer Mode automatically.

### Retainer Tracking

- OUT -> IN and IN -> OUT each create one timestamped local retainer punch.
- Closing/reopening the app does not lose elapsed wear time.
- A session crossing midnight calculates correctly.
- Multiple IN/OUT pairs remain valid.
- Notification failures do not undo committed punches.

### Bedtime Reminder

- Enabled reminder schedules at the configured local time while OUT.
- Going IN before it fires cancels the obsolete reminder.
- Changing the reminder time reconciles without duplicates.
- A missed reminder is not delivered immediately on resume.

### Morning Reminder

- Going IN schedules the next applicable morning reminder when enabled.
- Going OUT before it fires cancels it.
- Changing the reminder time reconciles without duplicates.
- A missed reminder is not delivered immediately on resume.

### Automatic Morning OUT

- Default is OFF.
- When enabled and the app is active, a qualifying overnight IN is ended at the configured time.
- When the app was closed/suspended, resume creates the OUT punch at the configured time rather than resume time.
- Manual OUT before the configured time wins and no automatic duplicate is created.
- An IN punch created after the configured time is not immediately auto-ended.
- Changing the automatic time does not rewrite completed history.

### Disable Flow

- Turning the toggle OFF always asks for confirmation.
- Cancel leaves Retainer Mode unchanged.
- Confirming closes a current IN session when needed.
- Confirming ends the retainer period and cancels retainer reminders.
- Completed treatment and retainer history remain preserved.
- The app routes directly to Treatment Setup.
- Completing setup creates a new `Treatment`, not a new version of the completed treatment.
- The previous treatment is never silently reopened.

### Lifecycle Integrity

- Startup resolves active treatment, active retainer period, or setup-required state locally.
- Active tray and retainer periods cannot coexist.
- Only one retainer period can be active.
- All core Retainer Mode behavior works offline.

## Out of Scope for V1

Do not add:

- automatic transition into Retainer Mode at the final tray
- fake tray numbers for retainers
- retainer replacement/device inventory tracking
- multiple simultaneous retainer types
- orthodontist integration
- sensor-based retainer detection
- push-notification infrastructure
- server-side scheduling
- cloud dependency for reminders or wear tracking
- background services solely to force the morning OUT transition
- retainer-specific streaks, badges, scores, or gamification
- a full retainer statistics dashboard
- automatic reopening of completed treatments

## Future Enhancements

Potential later improvements:

- recent-night history
- average nightly wear
- configurable nightly wear goal
- Retainer Mode support in `Edit In/Out Times`
- retainer wear graphs
- tracking retainer replacement dates if users demonstrate a clear need

These should be evaluated after the core reminder and wear-tracking experience is proven useful.

## UX Principle

Retainer Mode should feel like the natural continuation of Aligner Tracker after active treatment, not like a separate app.

The user should still have one obvious action: mark whether the appliance is IN or OUT.

The mode should reduce the chance of forgetting nighttime retainers while requiring almost no daily maintenance.
