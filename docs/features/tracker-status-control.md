# Tracker Status Control

## Status

Planned.

This document defines the production/default interaction and visual treatment for the large IN/OUT control on the iOS Tracker screen.

A more elaborate or flashy version of the control is intentionally deferred to a separate future planning session and experimental branch. That experiment must not expand the scope of this feature.

## Purpose

The Tracker status control is the highest-frequency and most important interaction in the app. It should feel immediate, premium, physical, and trustworthy without becoming visually distracting or changing the underlying wear-tracking model.

This feature adds restrained 3D depth, coordinated haptic feedback, and short local audio feedback while preserving the existing local-first SQLite behavior.

## Product Goals

- Make the main IN/OUT control feel like a physical button rather than a flat touch target.
- Acknowledge touch immediately without pretending a state change has been persisted before SQLite succeeds.
- Make successful IN and OUT transitions recognizable through coordinated visual, haptic, and audio feedback.
- Preserve the existing fast, one-tap tracking workflow.
- Keep the implementation lightweight and local-only.
- Avoid novelty effects that would become annoying during repeated daily use.

## Scope

V1 applies to the large status control on the iOS Main Tracker.

Preserve:

- the control's current location and dominant size
- the current `TRAYS ARE IN` / `TRAYS ARE OUT` status text
- the existing tray artwork
- the OUT duration display
- the existing helper text
- the current tracker accessibility label/value/hint behavior
- the current SQLite mutation and notification-reconciliation flow
- the current Undo, Edit last, Redo, timer, and Change Tray behavior

Android, web, Apple Watch, Siri, and other surfaces are out of scope for this visual/feedback treatment unless separately planned.

## Visual Direction

Use a restrained raised 3D treatment rather than a glossy or highly skeuomorphic design.

The control should read as a slightly elevated physical surface composed of:

1. a raised front face
2. a darker lower/base layer visible mainly along the bottom and lower side edges
3. a subtle upper-edge highlight
4. a broad, soft cast shadow
5. very mild top-to-bottom tonal shading where it can be achieved cleanly with the existing native UI stack

The lower/base layer is the most important depth cue. It should create a small visible lower lip when the button is raised.

Do not change the control's overall position or hit target between IN and OUT states.

## Visual States

### Resting

The control appears raised above its base.

Target appearance:

- approximately 5 pt of apparent elevation
- lower lip clearly but subtly visible
- soft shadow below the control
- understated upper highlight
- no pulsing, glow, shimmer, or idle animation

The exact pixel values may be adjusted during physical-device tuning, but the result should remain restrained.

### Touch Down

Touch acknowledgement must be immediate.

When the user presses the control:

- move the visible face downward by approximately 3 pt
- compress/tighten the shadow
- hide most of the lower lip
- optionally darken the face very slightly
- do not change the persisted IN/OUT state yet
- do not change the status artwork/text merely because the finger is down

The visual effect should resemble physically depressing a raised button.

### Saving

Releasing the press starts the existing tracker mutation.

While the mutation is pending:

- prevent a second tracker toggle, preserving the existing mutation guard
- keep the control visually engaged/depressed until the mutation resolves when practical with the native button implementation
- preserve the existing saving accessibility state and user-visible saving feedback
- do not introduce any artificial minimum delay

The control is pending only for the real persistence duration.

### Success

After SQLite successfully commits the new wear state:

- update the status text, tray artwork, timer/read-model values, and accessibility value together from the committed state
- return the face to its raised position using a short ease-out transition
- target approximately 150–200 ms for the return transition
- trigger the success haptic
- play the matching IN or OUT sound

The successful visual return, haptic, and sound should feel coordinated as one confirmation event.

### Failure

If the tracker mutation fails:

- do not show the requested state as if it succeeded
- restore the original committed state
- return the control to its raised appearance
- preserve the existing error presentation
- trigger an error haptic
- do not play either normal success sound

Audio or haptic failures must never change the result of the tracker mutation.

## State Semantics

SQLite remains authoritative.

The press animation is immediate visual acknowledgement, not optimistic persistence.

The actual IN/OUT state, status artwork, timers, and read-model values change only after the existing SQLite write succeeds.

Do not add an artificial delay, debounce window, confirmation countdown, or deferred database write. The existing local toggle path should remain as fast as possible and continue targeting the project's sub-100 ms IN/OUT performance budget.

Do not move audio or haptic work into the SQLite transaction.

## Haptic Feedback

Use `expo-haptics` for V1 rather than a custom Core Haptics implementation or third-party haptics SDK.

### Successful Toggle

Use one crisp impact after the SQLite mutation succeeds:

- `Haptics.ImpactFeedbackStyle.Rigid`

The intent is a concise mechanical confirmation rather than a heavy vibration.

Do not fire the success haptic on initial touch-down because a touch-down does not prove persistence succeeded.

### Failed Toggle

If the tracker mutation fails, use:

- `Haptics.NotificationFeedbackType.Error`

Do not also fire the normal success haptic.

### System Behavior

Haptic feedback is enhancement-only.

If iOS suppresses haptics because of system settings or device state, tracking must continue normally. Do not add custom fallback vibration behavior.

V1 does not add an in-app haptics preference. Respect the device's system-level behavior.

## Audio Feedback

Use two short, bundled local sound effects from the same sonic family.

### IN Sound

The sound should suggest a soft, precise seat/lock action.

Direction:

- crisp but quiet
- slightly higher in tone than the OUT sound
- no musical melody
- no spoken audio
- no notification-style chime

### OUT Sound

The sound should suggest a soft release/unseat action.

Direction:

- crisp but quiet
- slightly lower in tone than the IN sound
- clearly related to the IN sound
- no dramatic pop or alert tone

### Sound Length

Prefer approximately 80–180 ms per sound.

Keep each sound at or below roughly 250 ms unless physical-device testing shows a slightly longer tail materially improves quality.

### Playback Policy

Use `expo-audio` for V1.

The sound files must:

- ship with the app as local bundled assets
- require no network access
- be loaded/prepared before the user needs them where practical
- remain small enough that they do not meaningfully affect app size or startup

Configure UI-feedback audio so that:

- it does not play through iPhone Silent Mode (`playsInSilentMode: false`)
- it mixes with other audio rather than pausing or ducking music, podcasts, or other playback (`interruptionMode: 'mixWithOthers'`)
- it does not request background playback
- it does not request microphone permission

Playback should be best-effort. A sound-player failure must not block, delay, roll back, or mark a successful tracker mutation as failed.

V1 does not add an in-app sound preference. Silent Mode is the primary user control for these nonessential UI sounds.

## Dependency Policy

The feature may add the official Expo packages required for the agreed feedback behavior:

- `expo-haptics`
- `expo-audio`

Install them with the Expo version-aware installer so their versions match the project's Expo SDK.

Do not add:

- a third-party animation library for this feature
- a third-party haptics SDK
- a third-party audio/sound-effect SDK
- analytics or telemetry for button interactions

Use the existing native Expo UI / SwiftUI presentation layer for the visible iOS control.

## Native UI Constraint

The iOS Tracker must continue satisfying the project's iOS UI purity rule.

Do not reintroduce React Native visual primitives such as `Pressable`, `View`, or `Animated.View` into the iOS Tracker to implement the effect.

Implementation order:

1. verify the exact Expo SDK 57 `@expo/ui/swift-ui` capabilities for native pressed-state, offset, shadow, background, shape, and animation behavior
2. implement the effect through Expo UI composition/modifiers if the required behavior is available
3. keep the existing SwiftUI `Button` semantics, hit target, accessibility, and disabled behavior
4. do not add custom native code merely for convenience

If exact touch-down state cannot be expressed through the supported Expo UI surface, document the verified capability gap before introducing a custom SwiftUI/local Expo module. Any such native bridge should be the smallest feature-local implementation possible and must not become a general animation system.

## Interaction Timing

The control should feel immediate.

Required sequence:

```text
finger down
  -> visual face depresses immediately
finger up / activation
  -> existing SQLite toggle begins
  -> duplicate toggle is blocked while pending
SQLite commit succeeds
  -> committed tracker state becomes visible
  -> face returns to raised position
  -> rigid success haptic
  -> matching IN/OUT sound
```

Failure sequence:

```text
finger down
  -> visual face depresses immediately
finger up / activation
  -> existing SQLite toggle begins
SQLite commit fails
  -> old committed state remains/restores
  -> face returns to raised position
  -> error haptic
  -> existing error UI remains visible
  -> no normal IN/OUT sound
```

Feedback operations should not be awaited in a way that delays the visible committed state.

## IN vs OUT Presentation

IN and OUT may use different existing theme colors/emphasis, but they must retain the same:

- outer geometry
- location
- hit target
- visual elevation
- press distance
- animation timing

The distinction should come primarily from state color, artwork/content, and the paired sounds rather than moving or resizing the control.

## Accessibility

Preserve the current native button semantics.

Requirements:

- status remains available through the accessibility value
- the hint continues to explain the physical action to take
- pending/saving state remains announced or exposed as it is today
- sound and haptics are supplemental and never the only indication of success or failure
- the visual state must remain understandable with audio unavailable and haptics suppressed
- do not use rapid flashing or repeated animation

The small press translation is functional feedback, not decorative motion. Do not add bounce, spring overshoot, wobble, parallax, or repeated motion in V1.

## Performance and Reliability

Preserve the project's existing IN/OUT performance target:

`Tap -> SQLite write completes -> correct tracker state visible` should remain under 100 ms on the reference device when practical.

Requirements:

- no network request on the toggle path
- no artificial delay before persistence
- no additional SQLite writes for animation, audio, or haptic state
- no polling
- no persistent animation loop
- no audio initialization on every tap if it can be prepared once for the Tracker lifecycle
- audio/haptic exceptions must not escape into the tracker mutation path

Measure the normal toggle path after implementation to confirm the polish did not create a meaningful regression.

## Testing

### Functional

Verify on a physical iPhone:

- IN -> OUT persists once and produces the OUT confirmation feedback
- OUT -> IN persists once and produces the IN confirmation feedback
- rapid repeated taps cannot create duplicate punches while a mutation is pending
- state text/artwork/timers do not switch before persistence succeeds
- injected/real persistence failure leaves the prior committed state intact
- failure produces an error haptic and no success sound

### Audio

Verify:

- both sounds are clearly distinguishable but feel related
- the sounds are restrained at normal media volume
- Silent Mode suppresses the sounds
- music/podcast playback is not paused or ducked
- repeated normal tracker use does not create overlapping or queued sound playback
- entering/leaving the Tracker repeatedly does not leak audio players/resources

### Haptics

Verify:

- the rigid success impact feels crisp rather than heavy
- the haptic occurs after successful persistence
- failed persistence uses error feedback instead
- suppressed/unavailable haptics have no effect on functionality

### Visual

Verify:

- raised depth is visible in light and dark mode
- the lower lip/shadow do not reduce text/artwork readability
- touch-down feels immediate
- the pressed state does not shift surrounding layout
- IN and OUT occupy exactly the same geometry
- the control remains usable on the smallest supported iPhone viewport

### Performance

Re-measure the existing IN -> OUT and OUT -> IN toggle benchmark in a release-like build on the reference device.

If the feature materially regresses the existing budget, profile the feedback path before changing architecture.

## Out of Scope

V1 does not include:

- custom Core Haptics patterns
- synchronized authored audio-haptic pattern files
- flashy glow or lighting effects
- bounce/spring overshoot
- particles
- 3D perspective/parallax
- animated backgrounds
- continuous idle animation
- user-selectable button styles
- sound packs
- haptic intensity settings
- sound settings beyond respecting Silent Mode
- changes to the wear-tracking data model
- delayed/queued persistence
- optimistic committed-state projection

## Future Experimental Branch

A separate future planning session will define an experimental, more elaborate/flashy tracker control.

That work should occur on a separate branch so it can be compared directly against this restrained production design.

Potential experimental directions may include richer motion, lighting, custom haptic patterns, more pronounced depth, or other premium effects, but none are approved requirements yet.

Do not implement any of those ideas as part of this feature.

## Implementation Handoff

Before implementation, read:

- `AGENTS.md`
- the Main Tracker and performance sections of `docs/mvp-plan.md`
- `docs/performance.md`
- `docs/features/expo-ui-swiftui-migration.md`
- this document

Preserve the existing tracker repositories, SQLite mutation semantics, read-model calculations, notification reconciliation, accessibility behavior, and iOS UI purity boundary.
