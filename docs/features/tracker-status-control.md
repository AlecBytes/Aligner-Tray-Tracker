# Tray IN/OUT Button Feedback Upgrade

## Status

Implemented on 2026-09-14. Automated validation, clean iOS prebuild, native-module
autolinking resolution, and the production iOS JavaScript bundle pass. A macOS/Xcode
native compile, physical-device visual/audio/haptic review, and before/after device
performance measurements remain release validation work.

## Implementation Record

Expo SDK 57 `@expo/ui` exposes standard `Button` activation and predefined button
styles, but it does not expose SwiftUI's `ButtonStyle.Configuration.isPressed` to
TypeScript. The implementation therefore keeps the existing Expo UI `Button` and
applies one feature-local custom modifier from
`modules/tracker-status-control`. Its native SwiftUI `ButtonStyle` owns the pressed
state, 5 pt lower lip, 3 pt depression, shadow compression, 175 ms ease-out return,
and Reduce Motion behavior. The module is Apple-only and registered through Expo
UI's public `ViewModifierRegistry` extension API.

`use-ios-tracker.ts` reports a small per-activation outcome only after the accepted
operation has a current, committed result. `use-tracker-status-feedback.ios.ts`
owns the two prepared `expo-audio` players, Expo haptics, focus/background generation
guard, and best-effort error isolation. No feedback is inferred from rendered status,
and post-commit readback or reminder failures do not become persistence failures.

The bundled IN and OUT cues are `toggle_002.wav` and `toggle_001.wav` from Kenney's
Interface Sounds 1.0 pack. Both are CC0-1.0, mono 44.1 kHz 16-bit WAV files of
approximately 141 ms and 158 ms. Full provenance is recorded in
`assets/sounds/ASSET-LICENSES.md`. The Expo Audio config explicitly disables
microphone permission, recording, and background playback/recording.

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

The depressed appearance tracks the native pressed state, independently of saving. On release or cancellation, return the face to its resting raised position with a short ease-out transition. A slow save must not leave the face stuck down.

Preserve native activation rules: touch-down alone never saves. Dragging away or otherwise canceling without activation produces no write, sound, or haptic. Disabled controls do not start a new press effect. VoiceOver activation invokes the same action without requiring touch-down.

Target duration:

- approximately 150-200 ms

Do not add bounce, spring overshoot, wobble, parallax, or decorative repeated motion in this production version.

## State and Persistence Semantics

The existing persistence behavior remains authoritative.

Native pressed appearance, the mutation lock, and committed wear state are independent. Animation completion must never gate persistence, state updates, or control availability.

| Event / outcome | Required behavior | Supplemental feedback |
|---|---|---|
| Enabled touch-down | Depress immediately; no write | None |
| Release with activation | Invoke the existing toggle once; return face to rest; retain mutation lock through authoritative readback | Wait for confirmed change |
| Cancellation before activation | Return to rest; no write | None |
| Confirmed `changed` result | Apply the returned committed punch through the existing flow | One success haptic and sound matching the returned punch status |
| `already-in-state` | Preserve existing no-op/readback behavior | None; no new transition occurred |
| `no-active-treatment` | Preserve existing missing-treatment handling | No success feedback |
| Persistence rejects | Preserve existing error/recovery behavior; do not project requested state | One error haptic; no success sound |
| Readback or reminder reconciliation fails after commit | Preserve the saved change and existing warning/retry behavior | Do not reclassify the save as failed or repeat confirmation |

The integration points are [the iOS button](../../src/features/tracker/tracker-screen.ios.tsx) and [the tracker mutation flow](../../src/features/tracker/use-ios-tracker.ts). The mutation flow currently handles errors internally and can complete without a change. Resolution of `toggleTracker()` alone is not proof of a successful transition.

Attach feedback to the accepted button operation's confirmed outcome. Select the sound from the returned committed status, not an inverted pre-tap value. Preserve the coordinator's duplicate-action and stale-result guards. A small outcome handoff is allowed; repository and transaction semantics remain unchanged.

The status text, artwork, timers, and other committed-state UI must continue to reflect successful persisted state rather than pretending a requested state was saved before SQLite succeeds.

Do not introduce an artificial minimum delay. Preserve the existing project's sub-100 ms IN/OUT toggle performance goal.

Audio and haptic work must remain outside the SQLite transaction and must never determine whether persistence succeeds.

## Success Feedback

After a confirmed transition caused by this button, coordinate feedback:

- the existing visible state updates
- any release animation finishes independently
- one success haptic occurs
- the matching IN or OUT sound plays

These should feel like one concise confirmation event rather than several separate effects.

Request success feedback promptly after the confirmed change, independently of release animation, authoritative readback, and reminder reconciliation. Do not wait for animation completion or a display-frame callback. Audio and haptic dispatch are independent best-effort operations.

Feedback belongs to this button activation only. Initial loading, rerenders, timer ticks, Undo, Redo, Edit last, Change Tray, and external state changes must not trigger these new effects. Do not watch the current IN/OUT status in a render effect to infer success.

If the Tracker loses focus, unmounts, or the app backgrounds before dispatch, skip supplemental feedback. Never replay stale confirmations on return. An accepted save still completes through the existing mutation flow.

Do not play success feedback merely because the user touched the button. It confirms a successful tracker change.

## Failure Feedback

If the existing tracker mutation fails:

- do not present the requested IN/OUT state as committed
- retain committed state and recover through existing authoritative readback; do not write an old snapshot over a concurrent change
- return the button to its resting raised appearance
- preserve the existing tracker error presentation
- trigger an error haptic
- do not play either normal IN or OUT success sound

Audio or haptic failures must never create or transform a tracker persistence failure. Handle each effect separately outside the persistence error boundary, including asynchronous rejections. Unavailable feedback does not produce a tracker error.

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

The exact recordings/assets may be selected during implementation/design review, but the product behavior above is settled. Record asset sources, redistribution rights/licenses, and required attribution. Review the pair at comparable perceived volume; reject clipping, abrupt cutoffs, and excessive leading silence.

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

Prepare and reuse players outside the tap handler without blocking Tracker usability. If a sound is not ready at confirmation time, skip it rather than play a late confirmation. Start the chosen effect from its beginning and stop any previous button effect; never build a playback queue or delay legitimate tracker actions to prevent overlap.

Stop button audio on blur/background and release players when their owning lifecycle ends. Returning to the Tracker may prepare audio again but must not replay prior events. Audio-session configuration must coexist with other app audio features.

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
- Reduce Motion uses immediate pressed/resting changes without animated displacement
- preserve Dynamic Type legibility, VoiceOver focus, and contrast across supported themes, light/dark mode, Increase Contrast, and Reduce Transparency
- decorative layers do not become separate accessibility elements
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

Before implementation, read the exact [Expo SDK 57 docs](https://docs.expo.dev/versions/v57.0.0/) and [SwiftUI docs](https://docs.expo.dev/versions/v57.0.0/sdk/ui/swift-ui/), then verify the installed package surface. This proposal does not establish that custom pressed-state styling is already exposed.

If the required touch-down state is unsupported, document the verified capability gap and a compatible approach before implementing it. A feature-local native bridge must still satisfy the project's Expo UI-only presentation rule. This document does not authorize an exception to `AGENTS.md`.

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

Capture before/after measurements for both directions using [the performance plan](../performance.md). Record device, OS, build, dataset, median, and p95 where practical. Measure native press response, commit, committed-state display, and readback/control availability separately. The 150–200 ms return animation is outside the sub-100 ms commit/display budget and must not block it. Scheduling React state alone does not prove that the display updated.

## Testing

Test this as an upgrade to the existing Tracker button, not as a new workflow.

### Focused Automated Coverage

Extend existing tracker tests at the operation/feedback boundary to verify:

- one accepted `changed` operation requests one matching sound and success haptic
- blocked activation, no-op results, and unrelated refreshes emit no feedback
- rejected persistence emits error feedback only
- audio/haptic failures cannot affect saved state or produce persistence errors
- readback/reminder failures after commit do not emit an error haptic or duplicate success
- stale completions after blur/unmount do not emit feedback

Mock effect dispatch for these checks. Sound quality, system audio policy, and native interaction require device validation. Run the project validation suite, including `npm run check:ios-ui-purity`.

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
- drag-away/cancellation restores the face without saving or emitting feedback
- slow/failed saves do not leave the face depressed
- VoiceOver activation works without touch-down and Reduce Motion removes animated displacement
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
