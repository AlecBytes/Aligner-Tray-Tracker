# Apple Watch Companion

## Purpose

Provide the fastest practical way to perform Aligner Tracker's most frequent action: marking aligners IN or OUT.

The Apple Watch experience is intentionally narrow. It is a companion to the iPhone tracker rather than a second implementation of the application.

## Product Principle

> The Watch provides the control. The iPhone records the truth.

The iPhone's SQLite database remains the authoritative source of treatment and wear data.

V1 must not introduce independent Watch persistence or multi-device synchronization semantics.

---

## User Goal

A user should be able to remove or insert their aligners and accurately record that event from their wrist without taking out their phone.

The interaction should require approximately one obvious tap.

---

## V1 Screen

Use one primary Watch screen.

The large IN/OUT control should visually dominate the interface.

Display:

- current tray number
- current tray day
- current IN/OUT state
- large IN/OUT control
- today's IN total
- today's OUT total

Example:

```text
TRAY 9 • DAY 5

┌─────────────────┐
│                 │
│    TRAYS IN     │
│                 │
│ Tap when removed│
└─────────────────┘

IN TODAY    OUT TODAY
20h 17m       1h 42m
```

When OUT, the same control changes to communicate that tapping it records insertion.

Exact typography and layout should follow native watchOS conventions rather than attempting to reproduce the iPhone screen.

---

## Time Display

Today's IN and OUT durations should be concise.

V1 does not need a continuously updating seconds display.

Minute-level values are sufficient for the Watch because:

- the primary purpose is quick status awareness and input
- persisted accuracy still comes from timestamps
- constant second-level UI updates provide little additional Watch utility

The iPhone tracker may continue displaying seconds according to its existing behavior.

---

## Tracking Behavior

### IN → OUT

When the authoritative current state is IN:

1. User taps the Watch control.
2. Watch enters a pending state.
3. Watch sends the requested transition to the paired iPhone.
4. iPhone executes the existing wear-toggle application logic.
5. The resulting `WearPunch` is committed to SQLite.
6. iPhone returns the resulting authoritative tracker state.
7. Watch updates its UI.
8. Watch provides success haptic feedback.

### OUT → IN

Use the same flow for the inverse transition.

The Watch must not independently calculate or insert wear history.

---

## Single Source of Tracking Logic

Do not create a Watch-specific version of wear-tracking business rules.

The iPhone application should continue owning:

- validation
- current-state determination
- punch creation
- timestamps
- transaction handling
- notification reconciliation
- duration calculations
- treatment-plan interpretation
- tray-period relationships

The Watch sends user intent and consumes the resulting tracker state.

This avoids behavior differences between iPhone and Watch tracking.

---

## Pending Actions

Only one Watch tracking operation may be pending at a time.

After a tap:

- immediately give visual acknowledgement
- disable another toggle until the first operation resolves
- show a subtle pending state

Do not create duplicate punches from repeated taps.

### Success

After the iPhone confirms the SQLite write:

- display the returned authoritative state
- provide an appropriate success haptic

### Failure

If the request or iPhone operation fails:

- restore/display the last confirmed authoritative state
- provide appropriate error feedback
- show a short error message such as `Couldn't update`

Never display an unconfirmed state as though the punch has been successfully recorded.

---

## Connectivity Policy

### V1 decision

**A reachable paired iPhone is required to create a Watch IN/OUT event.**

The Watch may retain and display the last received tracker snapshot, but cached state does not make the Watch an independent source of tracking data.

### When the iPhone is unavailable

Display:

- last-known tracker state
- last-updated information when useful
- a clear but unobtrusive disconnected indication

Disable tracking actions.

Example:

```text
TRAYS IN

iPhone unavailable
Last updated 10:42 PM
```

Do not:

- create a Watch-local `WearPunch`
- maintain an outbound event queue
- pretend a state transition succeeded
- reconcile delayed Watch events later

---

## Why Offline Writes Are Deferred

Allowing disconnected writes would turn the Watch into a second writable data source.

Example:

1. Watch records OUT while disconnected.
2. iPhone records IN independently.
3. Watch later reconnects.
4. Events arrive out of order.

Correct handling would require product rules for:

- stable cross-device event IDs
- ordering
- stale state
- duplicate events
- simultaneous edits
- conflicts
- failed delivery
- reconciliation with punch corrections
- tray-period boundaries

These concerns overlap with the separately deferred multi-device synchronization problem.

V1 therefore avoids them entirely.

---

## Watch Read Model

The Watch should receive only the compact state required by its interface.

Conceptually:

```ts
type WatchTrackerSnapshot = {
  trayNumber: number;
  totalTrays: number;
  trayDay: number;
  status: 'IN' | 'OUT';
  inTodayMinutes: number;
  outTodayMinutes: number;
  updatedAt: string;
};
```

This is illustrative rather than a required exact TypeScript contract.

Prefer deriving this snapshot on the iPhone from existing application/repository behavior.

Do not send complete punch history or the SQLite database to the Watch merely to render V1.

---

## iPhone → Watch Updates

The Watch should receive updated tracker state when relevant iPhone state changes, including:

- IN/OUT actions
- tray changes
- treatment-plan changes that affect visible Watch information
- app activation/resume when refreshing stale Watch state is useful

Prefer latest-state semantics over replaying historical updates.

The Watch does not need every intermediate tracker snapshot; it needs the newest authoritative state.

---

## Initial Launch

If the Watch has never received tracker data:

- attempt to obtain current state from the paired iPhone
- show a native loading state while doing so

If no treatment has been configured on the iPhone, show a concise instruction to complete setup on iPhone.

Do not implement treatment setup on the Watch.

---

## No Treatment State

Example:

```text
Set up treatment
on your iPhone
```

No other actions are required.

---

## Haptics

Use native Watch haptics sparingly.

V1:

- success feedback after a confirmed IN/OUT write
- error feedback after a failed action

Do not create unnecessary haptics for routine screen updates or synchronization.

---

## Architecture

### Authoritative data

```text
Apple Watch
    │
    │ user intent
    ▼
paired iPhone
    │
    ▼
existing application/domain logic
    │
    ▼
SQLite
SOURCE OF TRUTH
    │
    │ resulting tracker snapshot
    ▼
Apple Watch
```

The feature must preserve the project's local-first architecture.

### Network

Internet access is not part of the tracking path.

Watch functionality must not depend on:

- Supabase
- Sign in with Apple
- cloud backup
- external APIs
- internet availability

Communication is between the paired Apple devices.

---

## Implementation Boundary

The watchOS interface will necessarily involve native Apple platform functionality.

However, adding Watch support must not cause broader application logic to migrate from TypeScript/React Native into Swift.

Keep the native boundary narrow:

- watchOS UI
- Watch Connectivity transport/integration
- any native lifecycle glue required by the platform

Keep treatment and wear business logic in the established application architecture.

---

## Feasibility Spike

Before full implementation, prove that the current Expo/EAS setup can support the required Watch architecture.

### Questions to answer

1. Can a SwiftUI watchOS companion target be added while preserving the project's current Expo/CNG workflow?
2. Can EAS Build correctly provision, sign, build, and archive both targets?
3. Can the resulting app be installed on a real paired iPhone and Apple Watch?
4. Can the Watch send an action to the iPhone through Watch Connectivity?
5. What happens when the iPhone application is:
   - foregrounded
   - backgrounded
   - suspended/not actively running
6. How should native Watch messages bridge into the existing application/service layer?
7. Can that bridge reuse existing authoritative wear-toggle behavior without reproducing the rules in Swift?
8. How should the latest tracker snapshot be pushed back to the Watch?

### Spike output

Document:

- proven project/target structure
- required config plugin or native configuration
- EAS configuration changes
- Apple capabilities/entitlements
- Watch Connectivity integration boundary
- limitations discovered during real-device testing

If the existing Expo/CNG approach cannot reasonably support the feature, stop and evaluate alternatives before introducing permanent native-project complexity.

---

## Performance

The Watch interaction should feel immediate.

Do not add:

- polling
- continuous database reads
- continuously persisted timers
- background network work

The only authoritative write caused by a Watch toggle should be the same local work required by the equivalent iPhone action.

If Watch communication introduces noticeable latency, measure it before adding optimization complexity.

---

## Reliability

Tracking correctness is more important than making disconnected operation appear seamless.

A successful Watch interaction means:

> The corresponding authoritative iPhone operation completed successfully.

The application should prefer showing an unavailable/error state over creating ambiguity about whether an aligner event was recorded.

---

## V1 Scope

Include:

- watchOS companion target
- one tracker screen
- current tray
- tray day
- current IN/OUT status
- IN/OUT action
- today's IN/OUT totals
- pending state
- success/error haptics
- cached last-known snapshot
- disconnected state
- initial/no-treatment states
- iPhone-to-Watch state refresh

---

## Explicitly Deferred

Do not include in V1:

- disconnected/offline Watch punch creation
- Watch-local treatment database
- outbound Watch event queues
- conflict resolution
- Change Tray
- Treatment Plan
- Edit In/Out Times
- Statistics
- Graphs
- Cloud Backup
- account management
- notification settings
- support/donation UI
- Watch complications
- Smart Stack widgets
- independent Watch operation

---

## Later Enhancements

After V1 proves reliable, evaluate:

### Complication / widget

Potentially show:

- current IN/OUT state
- tray number
- elapsed OUT duration where appropriate

Tapping should open directly to the Watch tracker.

### Offline tracking

Only reconsider after the project's multi-device event and conflict semantics are explicitly designed.

### Change Tray

Only add if real usage demonstrates meaningful value on Watch. The operation is much less frequent and substantially more complex than an IN/OUT tap.

---

## Acceptance Criteria

V1 is complete when:

1. The Apple Watch displays the current authoritative tracker state received from the iPhone.
2. The screen is centered around one obvious IN/OUT action.
3. A user can mark aligners IN or OUT when the paired iPhone is reachable.
4. The corresponding event is persisted through the existing authoritative iPhone tracking flow.
5. The Watch updates from the state returned after that operation.
6. Duplicate taps cannot create unintended events while an action is pending.
7. A failed operation cannot leave the Watch displaying an unconfirmed state as successful.
8. When the iPhone is unavailable, cached state may be displayed but new tracking actions are disabled.
9. Changes performed directly on the iPhone propagate the latest relevant state to the Watch.
10. The feature requires no account, Supabase access, or internet connection.
11. No independent Watch synchronization architecture is introduced.
12. The feature is tested on a real paired iPhone and Apple Watch.

---

## Success Criterion

The Watch feature succeeds if routine IN/OUT tracking becomes meaningfully easier without weakening the reliability or simplicity of the existing tracker.

The intended experience is:

> Raise wrist → tap once → event is reliably recorded.