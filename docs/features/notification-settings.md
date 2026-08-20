# Notification Settings

## Purpose

Give users direct control over the two useful local reminders while preserving the app's performance-first, utility-first, local-first design.

This feature supersedes the earlier MVP assumption that the OUT reminder is permanently fixed at 45 minutes and that there is no notification-settings UI.

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

Default:

- Enabled
- 45 minutes

The duration should be editable as a positive whole number of minutes.

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

Tray Change Reminder
[x] Remind me when it is time to change trays

Reminder time
[ 9:00 AM ]
```

### Tray Change Reminder

Controls:

- Enabled / disabled
- Reminder time of day

Default:

- Enabled
- 9:00 AM local time

The reminder fires once on the calculated due date for the current tray.

Do not automatically change trays.

Do not repeat the tray-change notification every day when a tray is overdue.

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
- tray-change reminder enabled
- tray-change reminder local time

Use the existing settings/storage pattern if one exists.

If the schema needs to change, add a proper SQLite migration rather than recreating the database.

Existing users should receive defaults that preserve current behavior where practical.

## OUT Reminder Scheduling

When trays transition from `IN` to `OUT`:

1. Read current notification preferences.
2. If the OUT reminder is disabled, do not schedule one.
3. If enabled, schedule one local notification for:

`OUT timestamp + configured reminder duration`

Message:

`Your trays have been out for {N} minutes.`

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

Do not automatically advance the tray.

## Changing the Tray Reminder Setting

When the tray-change reminder is disabled:

- cancel any pending tray-change reminder

When it is enabled or its reminder time changes:

- cancel the previous pending reminder
- recalculate the current tray's due date
- if the resulting due date/time is in the future, schedule it
- if the resulting due date/time has already passed, do not send an immediate catch-up notification

The next tray change will establish the next normal reminder.

## Reconciliation Events

Notification scheduling should be reconciled when any event changes the facts used by a reminder:

- IN → OUT
- OUT → IN
- tray change
- treatment-plan edit
- notification-setting edit

A lightweight reconciliation on app startup/resume is acceptable if useful for reliability, but do not add polling or continuous background work.

## Duplicate Prevention

There should never be multiple pending notifications for the same logical reminder.

Use the existing notification service/module and preserve clear identifiers for:

- current OUT reminder
- current tray-change reminder

Cancel/recreate as needed rather than stacking duplicates.

## Sound Behavior

Both the OUT reminder and tray-change reminder should use the device's normal
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

## Out of Scope

Do not add:

- push notifications
- server notification infrastructure
- cloud sync
- account-based notification preferences
- repeated overdue-tray reminders
- notification analytics
- marketing notifications
- statistics
- treatment-plan history UI

## UX Principle

Notification settings exist to make the core tracker more useful, not to increase engagement.

Defaults should be sensible, controls should be understandable, and disabling reminders should be easy.
