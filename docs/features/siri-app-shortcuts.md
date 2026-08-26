# Siri / App Shortcuts

## Purpose

Allow the user to record the two most common Aligner Tracker actions without opening or interacting with the app:

- mark trays OUT
- mark trays IN

The feature should behave as a hands-free extension of the existing tracker rather than introducing a separate tracking workflow.

This is an iOS-first convenience feature built on Apple's App Intents / App Shortcuts system.

---

## Product Goals

1. Make recording tray removal and insertion possible with minimal friction.
2. Preserve the accuracy and invariants of the existing timestamp-based wear-tracking model.
3. Work without requiring the Aligner Tracker UI to open during normal successful use.
4. Remain fully local and independent of cloud connectivity.
5. Reuse existing tracker behavior instead of introducing parallel Siri-specific state.

---

## Platform Scope

### V1

iOS only.

Use Apple's modern App Intents / App Shortcuts integration.

The feature requires iOS 16.4 or later, matching the application's configured iOS
deployment target. It requires a development or production build because the local
native module and generated app-target intents are unavailable in Expo Go.

### Later

Potential future support may include:

- richer Siri queries
- Apple Watch-specific interactions
- Android voice assistants

These are not part of V1.

---

## V1 Actions

Expose two explicit actions.

### Mark Trays OUT

Represents the user removing their aligners.

If the current saved state is `IN`, create an `OUT` `WearPunch`.

### Mark Trays IN

Represents the user inserting their aligners.

If the current saved state is `OUT`, create an `IN` `WearPunch`.

### Why Explicit Actions Instead of Toggle

Siri must operate on the user's requested end state rather than blindly toggling the current state.

For example:

> "Mark trays out"

must mean:

> ensure the current state is OUT

It must never mean:

> invert whatever state currently exists

This prevents an ambiguous or repeated voice command from incorrectly changing wear state.

---

## Siri Phrases

App Shortcut phrases should be short and natural while meeting Apple's requirements for invoking the application.

Example concepts:

```text
Mark trays out in Aligner Tracker
Trays out in Aligner Tracker
Mark trays in in Aligner Tracker
Trays in in Aligner Tracker
```

Exact phrases should be tested on a physical device during implementation.

Do not make support for the phrase:

```text
Siri, tray out
```

a V1 requirement if Apple requires the application name as part of App Shortcut activation.

The system may support semantically similar wording beyond the phrases explicitly registered by the app.

---

## State Transition Behavior

### Current IN + Mark OUT

Create:

```text
WearPunch
status: OUT
timestamp: Siri invocation timestamp
tray period: current active TrayPeriod
```

Then reconcile local notifications.

Return a short success response such as:

```text
Trays marked out.
```

### Current OUT + Mark IN

Create:

```text
WearPunch
status: IN
timestamp: Siri invocation timestamp
tray period: current active TrayPeriod
```

Then reconcile local notifications.

Return a short success response such as:

```text
Trays marked in.
```

### Current OUT + Mark OUT

Do not create another punch.

Return a response such as:

```text
Your trays are already out.
```

### Current IN + Mark IN

Do not create another punch.

Return a response such as:

```text
Your trays are already in.
```

Repeated requests for the existing state must therefore be idempotent.

---

## Timestamp Semantics

The resulting `WearPunch.timestamp` represents the start of the App Intent's
`perform()` execution. The intent captures this timestamp before opening SQLite or
performing any notification work.

It must not represent when JavaScript, React Native, or another delayed processing layer eventually handles the request.

Example:

```text
12:15:03 — user invokes "Mark trays out"
12:15:07 — application finishes processing

WearPunch.timestamp = 12:15:03
```

This preserves the accuracy of wear calculations.

Apple does not provide a general original speech/request timestamp for Siri and App
Shortcuts. `IntentSystemContext.preciseTimestamp` is specific to supported Action
button invocations such as Apple Watch Ultra. V1 therefore uses the earliest timestamp
available to the application: entry to `perform()`.

---

## Exactly-Once Processing

Each Siri/App Intent execution must be applied at most once.

A queued invocation must not generate another `WearPunch` because the app:

- launches
- resumes
- reconnects to the JavaScript runtime
- processes the same pending intent twice

App Intents does not expose a stable, general-purpose invocation identifier. V1 uses
an atomic desired-state SQLite transaction and state-level idempotency: the first
execution can create the requested transition, while immediate system retries or
repeated same-state commands observe the requested state and create no punch.

The transaction re-reads the active tray and latest punch after obtaining the SQLite
write lock. A delayed execution whose timestamp can no longer be inserted without
violating timeline ordering fails safely without modifying data.

---

## Existing Tracker Invariants

Siri must not bypass existing tracker rules.

The operation must preserve:

- exactly one active `TrayPeriod`
- valid active treatment
- timestamp ordering
- alternating `IN → OUT → IN → OUT` wear state
- no duplicate same-state transition
- SQLite as the local source of truth

Siri integration should reuse or share the same application/repository-level mutation behavior as the tracker where practical.

Do not maintain a separate Siri-specific wear state.

---

## Notification Behavior

A successful Siri state change must behave like the equivalent tracker action.

### Mark OUT

Reconcile the existing OUT-too-long reminder using the new OUT time and the user's current notification settings.

### Mark IN

Cancel or reconcile the pending OUT reminder as appropriate.

Siri integration must not create a separate notification scheduling system.

Notification reconciliation should continue through the existing notification feature.

---

## Application Lifecycle

Normal Siri actions should work when Aligner Tracker is:

- foregrounded
- backgrounded
- terminated

Where supported by iOS, they should also work while the device is locked.

A successful normal action should not require visibly launching or navigating into the Aligner Tracker UI.

If a particular error requires the user to open Aligner Tracker, Siri may instruct them to do so.

---

## No Active Treatment

If no valid active treatment or tray period exists:

- do not create a `WearPunch`
- do not partially mutate application state
- return a concise error response

Example:

```text
Open Aligner Tracker to set up your treatment first.
```

The exact wording may be adjusted for Siri usability.

---

## Failure Behavior

If the local write cannot be completed:

- do not report success
- do not create partial state
- leave the persisted tracker state authoritative

Return a concise failure response such as:

```text
I couldn't update Aligner Tracker.
```

Do not expose SQLite, transaction, or implementation terminology to the user.

The `WearPunch` is committed before notification reconciliation. If reminder
scheduling fails afterward, keep the committed punch authoritative and tell the user
that the trays were marked but reminders could not be refreshed. Normal application
initialization retries notification reconciliation.

---

## Data Model

V1 should continue using normal `WearPunch` records.

Do not add Siri-specific columns such as:

```text
source = siri
```

unless a future product requirement actually needs provenance.

Siri-created punches should therefore be indistinguishable from tracker-created punches after persistence.

They must remain editable through the existing Edit In/Out Times feature.

---

## Architecture

Keep the feature local-first.

Expected flow:

```text
Siri / App Shortcut
        ↓
App Intent
        ↓
tracker/application mutation
        ↓
SQLite WearPunch
        ↓
notification reconciliation
```

No network request should be required.

Do not introduce:

- cloud infrastructure
- authentication requirements
- remote Siri processing owned by Aligner Tracker
- synchronization dependencies
- a parallel persistence mechanism

The user's phone remains responsible for the tracker operation.

---

## Implementation Boundary

The feature specification defines required behavior but does not permanently prescribe the Expo/native integration mechanism.

At implementation time, evaluate current Expo support.

Preference order:

1. stable first-party Expo App Intents support
2. small native/config-plugin integration
3. well-maintained third-party dependency only when it substantially reduces complexity

Avoid adding a dependency solely to avoid a small amount of straightforward native integration.

Any native implementation should expose the smallest interface needed for the V1 actions.

The native SQLite and notification implementation lives in a project-local Apple-only
Expo module. The config plugin places only the thin App Intent declarations and App
Shortcuts provider in the generated main app target. This preserves iOS 16.4 metadata
discovery; Apple's framework-level `AppIntentsPackage` export API begins with iOS 17.
An Expo app-delegate subscriber asks the generated provider to refresh its shortcut
parameters at launch.

---

## Performance

The local tracker mutation should remain comparable to the normal IN/OUT tracker operation.

Do not include Siri speech recognition or operating-system dispatch latency when evaluating the existing application-side IN/OUT performance budget.

Do not introduce network activity onto this path.

---

## App Shortcuts Availability

The two actions should be exposed through Apple's App Shortcuts system in addition to Siri.

This allows the operating system to surface them through supported system experiences without requiring a separate Aligner Tracker feature for each integration.

Potential system surfaces may include:

- Siri
- Shortcuts
- Spotlight
- hardware/system shortcut surfaces supported by iOS

Aligner Tracker does not need custom UI for each surface in V1.

---

## User Confirmation

Do not require a second confirmation step before normal IN/OUT mutations.

The goal is to provide a low-friction equivalent of the existing tracker control.

A successful command should perform the action immediately and then provide a brief confirmation.

Existing punch-correction functionality provides a recovery path for accidental entries.

---

## Accessibility and Privacy

The feature should require no account.

No Siri interaction data should be stored beyond the normal `WearPunch` required by the requested tracking action.

Do not add analytics or telemetry specifically for Siri usage.

Locked-device execution is acceptable for the V1 IN/OUT actions because these actions expose and modify only the minimum tracker state necessary for the requested operation.

---

## Testing

Test on a physical iPhone.

Required scenarios:

### App lifecycle

- app foregrounded
- app backgrounded
- app terminated
- device locked

### State transitions

- IN → Mark OUT
- OUT → Mark IN
- OUT → Mark OUT
- IN → Mark IN

### Data integrity

Verify:

- exactly one punch created for a valid transition
- invocation timestamp is preserved
- duplicate processing does not create another punch
- punch belongs to the active tray period
- normal alternating sequence remains valid

### Notifications

Verify:

- Mark OUT schedules/reconciles the OUT reminder correctly
- Mark IN cancels/reconciles it correctly
- repeated same-state commands do not create incorrect notification changes

### Errors

Verify:

- no active treatment
- no active tray period
- database mutation failure where practical
- queued/delayed intent processing

### Existing app

After a successful Siri action:

- opening Tracker shows the correct state
- today's IN/OUT calculations include the Siri-created punch
- Statistics includes it normally
- Edit In/Out Times can edit it normally

---

## V1 Acceptance Criteria

V1 is complete when:

- `Mark Trays OUT` and `Mark Trays IN` are exposed as App Intents.
- Both actions are available through Siri/App Shortcuts on supported iOS devices.
- Commands operate without visibly opening the app during normal successful use.
- Commands work with the app foregrounded, backgrounded, and terminated.
- Locked-device operation works where supported.
- A valid state change creates exactly one normal `WearPunch`.
- The original invocation timestamp is used.
- A request matching the existing state creates no additional punch.
- Each invocation is processed at most once.
- Existing tracker invariants remain intact.
- Existing local notification behavior is reconciled.
- Siri returns concise success, already-in-state, and error responses.
- No network or account is required.
- Siri-created punches work normally throughout the rest of the application.

---

## Out of Scope for V1

Do not include:

- "Are my trays in or out?"
- "How long have my trays been out?"
- wear-time/statistics queries
- current tray queries
- tray changing
- treatment-plan modification
- punch correction through Siri
- Siri undo/redo
- custom Siri settings screen
- Apple Watch-specific UI
- Android voice-assistant integration
- Siri-specific analytics
- Siri-specific fields in `WearPunch`
- cloud processing

These may be evaluated separately after the core two-action workflow is proven useful.

---

## Success Criterion

The feature succeeds when removing or inserting aligners can be recorded through Siri with the same correctness as tapping the tracker, without adding meaningful friction or architectural complexity.
