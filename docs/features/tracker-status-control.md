# Tray IN/OUT Button Feedback Upgrade

## Status

Planned.

## Purpose

The iOS Main Tracker already has a large Tray IN/OUT button that is the primary control for recording wear-state changes.

This feature does **not** add a new tracker control or redesign the tracking workflow. It upgrades the existing Tray IN/OUT button with higher-quality visual, haptic, and audio feedback while preserving its current behavior, layout role, persistence semantics, accessibility, and surrounding tracker UI.

The production direction is a restrained, premium physical-button feel. A more elaborate/flashy version will be explored later in a separate planning session and experimental branch.

## Existing Behavior to Preserve

The current iOS Tracker already provides a dominant Tray IN/OUT button that:

- shows `TRAYS ARE IN` or `TRAYS ARE OUT`
- shows the existing tray artwork
- shows the current OUT duration when trays are out
- shows the existing helper text such as `Tap when removed` or `Tap when inserted`
- invokes the existing local tracker toggle flow
- prevents conflicting tracker actions while a mutation is pending
- updates the visible tracker from committed local state
- exposes the current accessibility label, value, and hint behavior
- participates in the existing Undo, Edit last, Redo, timer, notification-reconciliation, and Change Tray workflows

All of that remains the product baseline.

## Upgrade Scope

Upgrade only the feedback and physical feel of the existing Tray IN/OUT button in the iOS Main Tracker.

The upgrade consists of:

1. restrained 3D visual depth in the resting state
2. immediate visual press/depression feedback on touch
3. a short return-to-rest animation after activation resolves
4. a crisp success haptic after a successful IN/OUT persistence operation
5. an error haptic if the persistence operation fails
6. a short, polished local IN sound after a successful transition to IN
7. a short, polished local OUT sound after a successful transition to OUT

This is a UI/feedback polish feature, not a tracker-domain feature.

## Explicitly Unchanged

Do not change:

- what tapping the button means
- the existing IN/OUT wear-punch model
- SQLite as the local source of truth
- the existing tracker mutation/repository behavior
- notification reconciliation behavior
- the timing calculations
- the button's location on the Tracker
- its role as the dominant interactive element
- the existing tray imagery and primary status copy
- Undo / Redo / Edit last behavior
- Change Tray behavior
- navigation
- the surrounding Tracker layout
- Android, web, Apple Watch, or Siri behavior

Do not add a confirmation dialog, hold-to-confirm interaction, delayed commit, countdown, debounce delay, or second tap requirement.

## Visual Upgrade

### Design Direction

Make the existing button look slightly raised and physically pressable without turning it into a glossy or heavily skeuomorphic control.

Use a layered treatment consisting of:

- the existing button face/content
- a darker lower/base layer visible mostly along the bottom and lower side edges
- a subtle upper-edge highlight
- a broad, soft cast shadow
- very mild tonal shading where it can be achieved cleanly with the existing native UI stack

The darker lower layer should create a small visible lower lip. That lower lip is the primary depth cue.

The result should look premium and tactile while remaining consistent with the otherwise clean native iOS Tracker.

### Resting State

When untouched, the existing Tray IN/OUT button should appear slightly elevated.

Target direction:

- about 5 pt of apparent elevation
- subtle lower lip
- soft shadow
- restrained top highlight
- no glow, pulse, shimmer, wobble, or continuous idle animation

Exact visual values may be tuned on a physical iPhone.

### Pressed State

When the user touches the existing button:

- depress the visible face by approximately 3 pt
- tighten/compress the shadow
- hide most of the lower lip
- optionally darken the face slightly
- keep the surrounding layout fixed
- keep the same overall hit target

The effect should visually resemble pressing a physical button into its base.

Touch-down feedback should be immediate. It must not wait for SQLite.

Touch-down is only visual acknowledgement; it does not represent a persisted IN/OUT state change.

### Return Animation

After activation resolves, return the button face to its resting raised position with a short ease-out transition.

Target duration:

- approximately 150-200 ms

Do not add bounce, spring overshoot, wobble, parallax, or decorative repeated motion in this production version.

## State and Persistence Semantics

The existing persistence behavior remains authoritative.

Required behavior:

1. finger touches the existing Tray IN/OUT button
2. button visually depresses immediately
3. activation invokes the existing local tracker toggle
4. duplicate/conflicting toggle actions remain blocked while the mutation is pending
5. SQLite commits the new wear state
6. the existing tracker read model updates from committed state
7. the button returns to its raised state
8. the matching success haptic and IN/OUT sound are triggered

The status text, artwork, timers, and other committed-state UI must continue to reflect successful persisted state rather than pretending a requested state was saved before SQLite succeeds.

Do not introduce an artificial minimum delay. Preserve the existing project's sub-100 ms IN/OUT toggle performance goal.

Audio and haptic work must remain outside the SQLite transaction and must never determine whether persistence succeeds.

## Success Feedback

After a successful committed IN/OUT transition, coordinate three forms of feedback:

- the existing visible state updates
- the button returns to its raised resting position
- one success haptic occurs
- the matching IN or OUT sound plays

These should feel like one concise confirmation event rather than several separate effects.

Do not play success feedback merely because the user touched the button. It confirms a successful tracker change.

## Failure Feedback

If the existing tracker mutation fails:

- do not present the requested IN/OUT state as committed
- preserve/restore the prior committed tracker state
- return the button to its resting raised appearance
- preserve the existing tracker error presentation
- trigger an error haptic
- do not play either normal IN or OUT success sound

Audio or haptic failures must never create or transform a tracker persistence failure.

## Haptic Feedback

Use the official Expo haptics package for this upgrade rather than introducing a custom Core Haptics implementation or third-party haptics SDK.

### Successful IN/OUT Change

Use one concise mechanical-feeling impact:

- `Haptics.ImpactFeedbackStyle.Rigid`

Tune the result on a physical iPhone. The goal is a crisp click-like confirmation, not a heavy vibration.

Do not fire the success haptic on initial touch-down.

### Failed IN/OUT Change

Use:

- `Haptics.NotificationFeedbackType.Error`

Do not also fire the normal success haptic.

### System Behavior

Haptics are supplemental feedback only.

If iOS suppresses haptics because of device/system state, the tracker must continue working normally.

Do not add a custom fallback vibration.

This upgrade does not add an in-app haptic preference.

## Audio Feedback

Add two short, high-quality bundled sound effects specifically for the existing Tray IN/OUT button.

They should sound related, subtle, and intentional rather than like generic notification sounds.

### IN Sound

The successful transition to IN should use a soft, precise seat/lock-style sound.

Direction:

- crisp but quiet
- slightly higher in tone than OUT
- short mechanical/tactile character
- no spoken audio
- no melody
- no notification-style chime

### OUT Sound

The successful transition to OUT should use a soft release/unseat-style sound.

Direction:

- crisp but quiet
- slightly lower in tone than IN
- clearly from the same sonic family as the IN sound
- no dramatic pop or alert sound

### Asset Quality

The final app should use intentionally selected production-quality assets.

Do not ship arbitrary placeholder clicks simply to satisfy the requirement.

Prefer approximately 80-180 ms per sound. Keep each effect roughly 250 ms or shorter unless physical-device testing shows a slightly longer tail materially improves the feel.

The exact recordings/assets may be selected during implementation/design review, but the product behavior above is settled.

### Playback Policy

Use `expo-audio` for local playback.

The two sounds must:

- ship locally with the app
- require no network access
- be prepared before they are needed where practical
- remain small and lightweight

Configure these nonessential UI sounds so that:

- iPhone Silent Mode suppresses them
- they mix with existing music/podcast playback instead of interrupting it
- they do not require background audio
- they do not require microphone permission

Sound playback is best-effort. A sound failure must not delay, roll back, or otherwise affect a successful wear-state change.

This upgrade does not add an in-app sound preference. Silent Mode remains the primary user control for these UI sounds.

## IN vs OUT Visual Consistency

The current IN and OUT states may retain their different theme colors/emphasis and content, but the upgraded button must use the same:

- outer geometry
- position
- hit target
- apparent elevation
- press distance
- animation timing

Do not move or resize the button when its state changes. Preserve muscle memory.

## Accessibility

Preserve the existing native button semantics and current accessibility behavior.

Requirements:

- current status remains available through the accessibility value
- the existing hint continues to explain when to tap the button
- pending/saving state remains available to accessibility as it is today
- audio and haptics are never the sole confirmation of state
- the visible state remains understandable when sound is unavailable and haptics are suppressed
- no flashing or repeated decorative animation

This upgrade should enhance the existing accessible control rather than replace its semantics with a custom gesture surface.

## iOS UI / Architecture Constraints

The current iOS Tracker uses `@expo/ui/swift-ui` and must continue satisfying the project's iOS UI-purity rule.

Do not reintroduce React Native visual primitives such as `Pressable`, `View`, or `Animated.View` into the iOS Tracker for this upgrade.

Implementation order:

1. verify the exact Expo SDK 57 `@expo/ui/swift-ui` capabilities needed for pressed-state styling, offset, shadow, background, shape, and animation
2. upgrade the existing native SwiftUI button through Expo UI composition/modifiers where possible
3. preserve its current native Button semantics, hit target, disabled state, and accessibility behavior
4. add no custom native implementation merely for convenience

If the required touch-down visual state cannot be expressed through the supported Expo UI surface, document the verified capability gap before introducing any feature-local native bridge.

Any such bridge must be narrowly scoped to upgrading this existing button and must not become a general animation/design system.

## Dependencies

This upgrade may add the official Expo packages needed for the agreed feedback:

- `expo-haptics`
- `expo-audio`

Install them with the Expo version-aware installer appropriate to the project's Expo SDK.

Do not add:

- a third-party animation library for this feature
- a third-party haptics SDK
- a third-party sound-effects SDK
- analytics or telemetry for button taps

## Performance and Reliability

The upgrade must preserve the existing tracker performance target:

`Tap -> SQLite write completes -> correct tracker state visible`

Target: under 100 ms on the project's reference device when practical.

Requirements:

- no network request on the IN/OUT path
- no artificial persistence delay
- no extra SQLite writes for visual, audio, or haptic feedback
- no polling
- no persistent animation loop
- do not initialize/load audio from scratch on every tap if it can be prepared once for the Tracker lifecycle
- do not await audio/haptic completion before showing already-committed tracker state
- audio/haptic errors must be isolated from tracker persistence

Re-measure the existing IN -> OUT and OUT -> IN performance benchmark after implementation.

## Testing

Test this as an upgrade to the existing Tracker button, not as a new workflow.

### Regression / Existing Behavior

Verify on a physical iPhone:

- the existing Tray IN/OUT button remains in the same location
- the same tap still creates exactly one appropriate wear-state transition
- existing `TRAYS ARE IN` / `TRAYS ARE OUT` content remains correct
- tray artwork and OUT duration remain correct
- Undo, Redo, Edit last, timers, notifications, and Change Tray still behave as before
- rapid repeated taps cannot create duplicate punches while a mutation is pending
- failed persistence leaves the prior committed state intact

### Visual Upgrade

Verify:

- the existing button clearly but subtly appears raised
- touch-down produces immediate depression feedback
- the lower lip/shadow sell the depth without making the UI look glossy or dated
- pressing does not shift surrounding layout
- IN and OUT retain identical geometry
- light mode and dark mode both look intentional
- the smallest supported iPhone viewport still fits the non-scrolling Tracker layout

### Haptics

Verify:

- successful IN and OUT changes use one crisp rigid impact
- the success haptic occurs only for a successful persistence operation
- a failed persistence operation uses error feedback instead
- suppressed/unavailable haptics do not affect tracker behavior

### Audio

Verify:

- IN and OUT sounds are distinct but clearly related
- both sound polished and restrained at normal volume
- Silent Mode suppresses them
- music or podcast playback is not interrupted or ducked
- repeated ordinary use does not produce overlapping/queued sound effects
- navigating away from and back to the Tracker does not leak player resources

### Performance

Re-run the existing IN -> OUT and OUT -> IN benchmark in a release-like build on the reference device.

If this upgrade materially regresses the existing budget, profile the feedback path before adding architectural complexity.

## Out of Scope

This production upgrade does not include:

- a new tracker control
- a new tracking workflow
- changes to the wear-punch model
- changes to persistence ordering
- optimistic committed-state projection
- delayed/queued persistence
- a hold-to-confirm interaction
- a confirmation dialog
- custom Core Haptics patterns
- synchronized authored audio/haptic pattern files
- flashy lighting or glow effects
- particles
- perspective/parallax
- bounce/spring overshoot
- animated backgrounds
- continuous idle animation
- sound packs
- selectable button styles
- haptic intensity settings
- additional sound settings

## Future Experimental Button

A separate future planning session will explore a more elaborate/flashy version of the existing Tray IN/OUT button.

That work should occur on a separate experimental branch so it can be compared directly with this restrained production upgrade.

Possible directions such as richer lighting, motion, custom haptics, stronger depth, or other premium effects remain intentionally undecided.

Do not implement those ideas as part of this feature.

## Implementation Handoff

Before implementation, read:

- `AGENTS.md`
- the Main Tracker and performance sections of `docs/mvp-plan.md`
- `docs/performance.md`
- `docs/features/expo-ui-swiftui-migration.md`
- this document

Implementation should modify the existing iOS Tray IN/OUT button rather than creating a parallel control or new tracker abstraction.

Preserve the existing tracker repositories, SQLite mutation semantics, read-model calculations, notification reconciliation, accessibility behavior, and iOS UI-purity boundary.
