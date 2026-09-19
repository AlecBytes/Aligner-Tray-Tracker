# Help

## Status

Proposed product scope.

## Purpose

Make practical guidance available from the main tracker screen without
interrupting the user's daily tracking workflow.

The app already provides a Help screen through Menu. The main tracker is the
place users spend most of their time, so Help should be discoverable there as
well. Direct access reduces the effort required when a user is unsure how to
record wear, change trays, correct a time, or configure reminders.

Help is an informational feature. It must not become a prompt, engagement
loop, support solicitation, or substitute for clinical advice.

## Product Decision

Add a compact Help control to the main tracker page's top action area, beside
Menu.

On iOS, the control uses a question-mark icon. Its meaning must remain clear
to assistive technology and must open the existing Help screen directly.

The Help control appears in both aligner and retainer modes. It remains
available while a tracker save is in progress because opening Help does not
change tracker state, write data, or affect the save operation.

Help also remains available from Menu. The direct tracker control is an
additional entry point, not a replacement for the existing Menu destination.

## What Help Should Do

The Help screen should provide concise, task-oriented guidance organized into
the following sections.

### Getting Started

Explain the basic setup and daily flow:

- Enter the treatment plan prescribed by the user's clinician.
- Tap the main tracker control when trays or retainers are removed or
  inserted.
- Understand the current tray, treatment day, and remaining time shown on the
  tracker.
- Know that tracking data is saved on the device and available when the app is
  reopened.

### Recording IN and OUT Time

Explain:

- What IN and OUT mean in the tracker.
- When to tap the main control.
- How the current OUT duration is shown.
- That the tracker records the user's action and is not a clinical judgment
  about prescribed wear.

### Changing Trays

Explain:

- When to use Change Tray.
- How the next tray is selected.
- That a newly started tray remains OUT until the user marks it IN.
- That changing trays preserves the treatment history already recorded.

### Correcting a Time

Explain:

- When to use Edit In/Out Times.
- That a mistaken or missed event can be corrected from the editing flow.
- That corrections update the saved local history used by intervals and
  statistics.

### Notifications

Explain:

- Which reminders can be configured in Notifications.
- That reminders depend on notification permission and device settings.
- That notifications are a convenience and do not replace the user's own
  treatment instructions.

### Retainer Mode

Explain:

- When Retainer Mode is appropriate for a completed aligner treatment.
- That the retainer tracker records retainer wear using the same basic IN/OUT
  interaction.
- Which aligner-specific controls are unavailable or presented differently in
  Retainer Mode.

### Contact Support

Retain the existing support contact section after the task guidance. Users
should be able to email support intentionally when the Help content does not
resolve their question.

Support contact must remain separate from optional financial Support products
and Premium Support. Help should not promote either one during normal use.

## Content Principles

Help content should be:

- concise enough to scan during a daily task
- written in plain language
- organized around user questions and actions
- consistent with the labels used elsewhere in the app
- clear that the app records user-entered events and does not diagnose,
  prescribe, or replace a clinician

Use the user's existing treatment instructions as the authority for clinical
decisions. Do not introduce target wear times, treatment recommendations, or
claims that are not already part of the user's prescribed plan.

## Navigation Behavior

- Tapping Help from the tracker opens the existing Help screen.
- Tapping Help from Menu opens the same screen.
- Returning from Help restores the tracker without changing the current
  tracker state.
- Opening Help never requires network access, an account, or a support
  purchase.
- Help remains available for both aligner and retainer users.

## Out of Scope

This feature does not include:

- contextual pop-ups over the tracker
- a first-use prompt or forced onboarding step
- badges, reminders, or repeated Help prompts
- a searchable knowledge base
- video, web embeds, or remote Help content
- in-app chat or ticket history
- automatic transmission of treatment data to support
- clinical guidance beyond explaining the app's controls
- removal of Help from Menu

## Product Acceptance Criteria

- A user can open Help directly from the main tracker page.
- The iOS entry point is a compact question-mark control with a clear
  accessible meaning.
- The entry point is present in both aligner and retainer modes.
- Help can be opened while a tracker save is in progress without changing or
  interrupting the tracker state.
- The existing Menu Help entry continues to open the same Help destination.
- The Help screen explains getting started, IN/OUT tracking, tray changes,
  time corrections, notifications, and Retainer Mode.
- Contact Support remains available after the guidance sections.
- Help content does not require network access, account creation, or purchase.
- Help does not make clinical claims or present itself as a replacement for a
  clinician's instructions.