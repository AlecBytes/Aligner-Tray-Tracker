# Notification Settings

## Purpose

Give users direct control over the two useful local reminders while preserving the app's performance-first, utility-first, local-first design.

This feature supersedes the earlier MVP assumption that the OUT reminder is permanently fixed at 45 minutes and that there is no notification-settings UI.

Daily overdue tray-change reminders are an optional extension of the due-date
reminder. This supersedes the earlier exclusion of repeated overdue-tray reminders.

## Entry Point

Add a menu item:

`Notifications`

This opens a single lightweight Notification Settings screen.

## Notification Settings Screen

The screen should contain two independent sections.

### OUT Reminder

Controls:

- Enabled / disabled
- `Remind me after` duration in minutes
- `Persistent reminder interval` in minutes

Default:

- Enabled
- 45 minutes
- Repeat every 5 minutes after the first reminder

The duration should be editable as a positive whole number of minutes.
The persistent interval should use the same 5-to-240-minute validation range.

Recommended validation range:

- minimum: 5 minutes
- maximum: 240 minutes

Example:

```text
Notifications

OUT Reminder
[x] Remind me when trays have been out too long

Remind me after
[ 45 ] minutes

Persistent reminder interval
[ 5 ] minutes

Tray Change Reminder
[x] Remind me when it is time to change trays

Reminder time
[ 9:00 AM ]

[ ] Remind me daily when overdue
```

### Tray Change Reminder

Controls:

- Enabled / disabled
- Reminder time of day
- `Remind me daily when overdue`

Default:

- Enabled
- 9:00 AM local time
- Daily overdue reminders off for new and existing users

The reminder fires once on the calculated due date for the current tray.

Do not automatically change trays.

When daily overdue reminders are enabled, remind once per local calendar day
after the due date at the existing reminder time. There is no separate overdue
reminder time. Disable the subordinate control when the parent tray-change
reminder is disabled, retaining its saved preference for when the parent is
enabled again. Use native `@expo/ui/swift-ui` controls on iOS.

## Device Permission State

If native notification permission is denied or unavailable:

- show a concise status message
- keep the user's reminder preferences stored
- provide a way to open device notification settings when supported
- do not block normal tracker use

When the user enables a reminder and notification permission has not yet been granted, request permission at an appropriate point.

If permission remains denied, the preference may remain enabled while the UI clearly indicates that notifications are currently blocked by the device.

Web should degrade gracefully if native local notifications are unavailable.

## Persistence

Notification preferences are local app data.

SQLite remains the source of truth.

Persist at least:

- OUT reminder enabled
- OUT reminder minutes
- OUT persistent reminder interval minutes
- tray-change reminder enabled
- tray-change reminder local time
- tray-change daily overdue reminder enabled

Use the existing settings/storage pattern if one exists.

If the schema needs to change, add a proper SQLite migration rather than recreating the database.

Existing users should receive defaults that preserve current behavior where practical.

The overdue reminder preference adds `trayChangeOverdueReminderEnabled` to the settings
type and `tray_change_overdue_reminder_enabled` to SQLite using the existing
boolean storage convention, constrained to 0 or 1 and defaulting to 0. Migration 7
preserves existing preferences. Native Swift accepts schema versions 4–7 and reads
false on older schemas without running migrations.

Include the preference in new backups. When reading older backups that omit it,
default it to false; a present value must be a boolean. See the settings
extension in [Cloud Backup & Restore](cloud-backup-restore.md).

## OUT Reminder Scheduling

When trays transition from `IN` to `OUT`:

1. Read current notification preferences.
2. If the OUT reminder is disabled, do not schedule one.
3. If enabled, schedule one local notification for:

`OUT timestamp + configured reminder duration`

Message:

`Your trays have been out for {N} minutes.`

After the first reminder, schedule another reminder at the configured persistent
interval while the trays remain OUT. Pending persistent reminders are replenished
when the app starts or resumes so the behavior remains local-only and does not
require polling or background services.

Repeated message:

`Your trays are still out. Put them back in.`

When trays transition from `OUT` to `IN`:

- cancel any pending OUT reminder

When changing trays:

- reconcile/cancel the previous OUT reminder
- the new tray begins OUT according to existing tray-change behavior
- schedule the new OUT reminder using the current configured threshold

## Changing the OUT Reminder Setting

When the OUT reminder is disabled:

- cancel any pending OUT reminder

When it is enabled or its duration changes:

- cancel the existing pending OUT reminder
- if trays are currently OUT, calculate the new target from the original OUT timestamp, not from the settings-change time
- if the new target is still in the future, schedule it
- if the new target has already passed, do not fire an immediate catch-up notification; wait for the next OUT session

## Tray Change Reminder Scheduling

The tray-change due date is derived from:

- current `TrayPeriod.startedAt`
- the current effective treatment plan's prescribed days per tray

Schedule the reminder at the user's configured local reminder time on that due date.

Message:

`You are scheduled to change to Tray N today.`

Where `N` is the expected next tray number when one exists.

If there is no next tray within the treatment plan, schedule neither the due-date
notification nor overdue notifications.

Do not automatically advance the tray.

### Daily Overdue Reminders

Schedule these only when both tray-change reminders and daily overdue reminders
are enabled. Preserve the due-date notification above.

The first overdue notification is on the next local calendar day after the due
date, at the configured reminder time:

`Your change to Tray N is 1 day overdue.`

On subsequent days:

`Your change to Tray N is D days overdue.`

`D` is the number of local calendar days between the scheduled change date and
the notification's scheduled date, not the number of completed 24-hour periods.
For example, a September 6 due date produces “1 day overdue” on September 7 and
“2 days overdue” on September 8. Never issue a zero-day overdue notification.

Build the next 14 future overdue notifications, each with its own calculated
message. This is 14 upcoming occurrences, not a cutoff at 14 days overdue. If
enabled several days late, begin at the next configured time strictly after now
with the correct overdue count. Today's reminder is eligible if its time has not
passed; otherwise begin tomorrow. Do not deliver missed notifications immediately.

Use calendar-day arithmetic across month/year boundaries and daylight-saving
transitions. A nonexistent overdue reminder time advances through the gap while
preserving minutes (for example, 2:30 AM becomes 3:30 AM); a repeated time uses its
first occurrence. On reconciliation, recalculate the due date and reminder times using
the current local timezone. Already scheduled requests retain their schedule
until reconciliation runs again.

Reserve slots for the due-date reminder, when still future, and the next 14
overdue reminders before allocating persistent OUT reminders. Keep the existing
64-request budget: 14 overdue reminders plus one due-date reminder leave 49 slots
for OUT reminders. When overdue reminders are off, preserve existing allocation.

Replenish the batch on startup, resume, and the reconciliation events below. If
the batch is exhausted without another reconciliation, daily reminders stop until
reconciliation runs again. This is bounded local scheduling, with no network,
polling, or continuous background work.

## Changing the Tray Reminder Setting

When the tray-change reminder is disabled:

- cancel all pending due-date and overdue tray-change reminders
- retain the saved daily overdue preference

When it is enabled, its reminder time changes, or the daily overdue option changes:

- reconcile obsolete pending due-date and overdue reminders
- recalculate the current tray's due date
- if the resulting due date/time is in the future, schedule it
- if the resulting due date/time has already passed, do not send an immediate catch-up notification
- if daily overdue reminders are enabled, build the next 14 future overdue notifications
- if daily overdue reminders are disabled, cancel that series while preserving any eligible due-date reminder

With daily overdue reminders off, the next tray change establishes the next normal
reminder after a missed due-date notification. With them on, future overdue
reminders continue for the unchanged tray within the scheduled batch.

## Reconciliation Events

Notification scheduling should be reconciled when any event changes the facts used by a reminder:

- IN → OUT
- OUT → IN
- tray change
- treatment-plan edit
- notification-setting edit

Reconcile on app startup/resume to replenish pending reminders. Tray changes and
relevant treatment-plan edits must cancel obsolete requests and rebuild from the
current tray and effective plan. Do not add polling or continuous background work.

Keep the TypeScript and native Swift policies in agreement, along with their
shared parity fixtures. Preserve the native coordinator
as the iOS scheduling path and the existing Expo notification path elsewhere.

## Duplicate Prevention

There should never be duplicate pending notifications for the same scheduled
reminder. The OUT reminder may have a series of unique pending notifications at
the configured persistent interval.

Use the existing notification service/module and preserve clear identifiers for:

- current OUT reminder
- current tray-change reminder
- each daily overdue tray-change reminder

Cancel/recreate as needed rather than stacking duplicates.

Overdue fingerprints must distinguish the tray period, scheduled date/time, and
overdue count, and change when the target tray or message changes. Reconciliation
must replace stale content, retain matching requests, and leave unrelated
notifications alone.

## Sound Behavior

The OUT reminder and all due-date and overdue tray-change reminders should use the device's normal
notification sound. On Android, schedule them on the treatment-reminders
notification channel with its sound set to the system default. Device silent or
focus modes and user-configured notification/channel settings may still suppress
the sound.

## Failure Behavior

Notification failures must not break core tracker actions.

For example:

- an IN/OUT punch should remain successfully recorded even if scheduling a notification fails
- tray changes should not roll back solely because the OS notification API failed
- treatment-plan edits should remain saved even if notification rescheduling fails

The tracker and SQLite data remain authoritative.

## Performance

Avoid:

- network requests
- push-notification infrastructure
- polling
- continuous background timers
- unnecessary dependencies
- recalculating unrelated historical data

Only reschedule when an event relevant to the reminders occurs.

## Tests

Add focused tests for:

- defaults
- persistence
- OUT reminder disabled
- custom OUT duration
- OUT duration changed while currently OUT
- new OUT target already in the past
- returning IN cancels the OUT reminder
- tray change reconciles the OUT reminder
- tray reminder disabled
- tray reminder time changed
- treatment-plan edit reschedules the tray reminder
- overdue tray does not trigger an immediate catch-up notification
- duplicate pending reminders are avoided
- notification API failure does not corrupt tracker/treatment state

Use the existing testing framework.

### Daily Overdue Reminder Acceptance Checks

- Default-off migration preserves existing settings; the new preference persists.
- Disabling the parent disables the subordinate control and cancels both tray
  reminder types while retaining the daily preference; disabling only the daily
  option preserves the eligible due-date reminder.
- New backups include the preference; older backups without it restore false;
  invalid present values are rejected.
- The due-date notification remains unchanged; the first overdue notification is
  the next calendar day, with correct singular/plural copy and next-tray number.
- Enabling several days late uses the correct count and the next future reminder
  time, including before, exactly at, and after today's configured time.
- Calendar counts and schedules remain correct across month/year boundaries and
  daylight-saving transitions; timezone reconciliation replaces stale requests.
- Exactly 14 future overdue occurrences are scheduled and replenished, including
  when already more than 14 days overdue; the combined queue stays within 64.
- Tray changes, relevant plan edits, disabling reminders, and reaching the final
  tray cancel obsolete requests without duplicates or immediate catch-up delivery.
- Shared fixtures verify Swift/TypeScript parity, and notification failures leave
  committed tracker data intact.

Run `npm run validate` and the native policy/parity checks for implementation
changes. Native delivery verification requires a rebuilt app because the Swift
scheduler changed.

Outstanding native verification: run the module XCTest suite in a generated iOS
project and verify iOS/Android delivery with the app closed, cancellation,
replenishment on resume, saved controls, and existing sound and permission behavior.
These checks require native build tools and devices unavailable on the Linux
implementation host.

## Out of Scope

Do not add:

- push notifications
- server notification infrastructure
- cloud sync
- account-based notification preferences
- a separate overdue reminder time or configurable repeat frequency
- unbounded overdue delivery without replenishing the local schedule
- notification analytics
- marketing notifications
- statistics
- treatment-plan history UI

## UX Principle

Notification settings exist to make the core tracker more useful, not to increase engagement.

Defaults should be sensible, controls should be understandable, and disabling reminders should be easy.
