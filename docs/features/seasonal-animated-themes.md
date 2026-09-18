# Seasonal Animated Themes

## Status

Proposed feature. This document defines the first implementation direction for seasonal animated themes. It does not authorize implementation of the feature without the validation and accessibility checks described below.

Seasonal themes are free, local-first features. They must not depend on an account, network access, billing state, RevenueCat entitlement, or treatment data.

## Product Direction

Seasonal animation should add a small amount of delight to the main Tracker without weakening its utility. The current IN/OUT state, tray information, durations, and primary tray control remain the visual hierarchy. Seasonal decoration is ambient background content, not an interaction surface.

The first prototype should be September leaves. October can add bats and ghosts after the rendering and performance behavior has been validated.

## Seasonal Calendar

Use the device's local calendar and time zone. The initial schedule is:

| Period | Theme | Motion |
|---|---|---|
| September | Falling leaves | Sparse leaves drift from the upper edges with slow rotation |
| October | Bats and ghosts | A few bats cross the upper background; ghosts float near the edges |
| November | Late autumn | Warm leaves and occasional lantern-like accents |
| December | Snow | Slow, sparse snowflakes with larger flakes near the edges |
| January | Frost | Mostly static frost details with very slow snow |
| February | Winter stars | Subtle stars or small hearts, subject to final visual review |
| March-May | Spring | Sparse petals or blossoms |
| June-August | Summer | Fireflies or restrained sun-fleck motion |

Season boundaries are product configuration, not treatment logic. The calendar must have a deterministic fallback for unsupported or invalid dates.

## User Controls

The default behavior is automatic seasonal selection. Themes should also expose an explicit `Seasonal` choice in the existing Themes screen, with these states:

- `Automatic`: select the current seasonal theme from the local date.
- `Off`: use the selected static color theme and render no seasonal scene.
- `Seasonal`: use the current seasonal theme even when the static color theme is selected.

The exact settings labels can be simplified during implementation, but the user must be able to disable motion without disabling the rest of the color theme system. The preference remains device-local and should use the existing app-settings infrastructure.

Reduce Motion must override animation. When enabled, render a static seasonal composition or omit the seasonal layer entirely. Never use flashing, rapid scale changes, or high-frequency movement.

## Visual Composition

The seasonal scene must sit behind or around the Tracker content and must not obscure:

- the tray number and day summary;
- the current IN/OUT state;
- the large tray control;
- Undo, Edit, Redo, and navigation controls;
- the IN TODAY and OUT TODAY metrics.

The scene must not receive touches. Decorative content must use hidden accessibility semantics so VoiceOver encounters the Tracker controls and information in their normal order.

Recommended first prototype:

- 8-10 leaf sprites;
- 10-18 second movement durations;
- entry from the top or upper side edges;
- slow translation and rotation only;
- no animation directly over the primary tray control;
- static fallback assets for Reduce Motion and animation failure.

Bitmap assets are preferred for leaves, bats, ghosts, and other detailed seasonal objects. Assets should be small, opaque where possible, and designed for light and dark appearance without relying on low-contrast transparency.

## Animation Implementation

Expo's animation guidance supports React Native Animated for simple cases and `react-native-reanimated` for more advanced, performant animations. This repository already includes `react-native-reanimated`, so the first implementation should use Reanimated rather than adding another animation dependency.

Each seasonal object should use transform and opacity properties driven by shared values. Avoid JavaScript intervals and per-frame state updates. Prefer a small, deterministic set of animated objects over an unbounded particle generator.

Suggested boundaries:

- `SeasonalThemeResolver`: resolves the local date and user preference to a stable theme key.
- `SeasonalThemeDefinition`: describes assets, count, palette, duration range, and static fallback.
- `SeasonalScene`: renders the non-interactive animated layer.
- `SeasonalScene.ios.tsx`: owns the iOS presentation boundary if platform-specific hosting is required.

The scene should start only when the Tracker is focused and the app is active. Pause or stop it on backgrounding and screen blur. It must not delay SQLite loading, tracker rendering, or IN/OUT persistence.

## iOS UI Architecture Decision

The current iOS Tracker presentation uses Expo UI / SwiftUI and is protected by the iOS UI-purity check. Expo's standard Reanimated examples use React Native visual primitives, which are not currently permitted in the iOS app graph.

For this feature, allow one narrowly scoped exception for a non-interactive seasonal scene:

- React Native visual primitives may be used only inside the seasonal scene component.
- The component must be decorative and use `pointerEvents="none"`.
- It must not contain buttons, text content, navigation, or business logic.
- It must not replace the SwiftUI Tracker layout or the existing tray-control exception.
- The iOS UI-purity checker must identify and validate this exception explicitly rather than silently ignoring the dependency.
- The exception must be documented in `AGENTS.md` and in the checker source before implementation begins.

The preferred integration is to host the isolated React Native scene at the existing SwiftUI/React Native boundary, subject to a small SDK 57 prototype. If that boundary cannot provide reliable sizing, z-order, accessibility hiding, or lifecycle behavior, stop and reassess rather than expanding the exception to the whole Tracker.

## Performance Requirements

Seasonal animation is supplemental UI and must yield to core tracker performance.

Initial implementation budgets:

- no measurable regression to cold startup or warm resume targets;
- no measurable regression to the existing IN/OUT visual-response or persistence targets;
- no more than 16 simultaneously animated objects on the Tracker;
- no continuous JavaScript timer or per-frame React state update;
- animation paused when the app is inactive or the Tracker is not focused;
- no unnecessary image decoding during the first interactive render.

Validate on a small supported iPhone and a release-like development build. Check memory, dropped frames, startup, warm resume, and IN/OUT response with the seasonal scene enabled, disabled, and in Reduce Motion mode.

## Accessibility and Safety

Verify the following:

- Reduce Motion produces a static scene or no scene.
- VoiceOver does not announce decorative objects.
- Dynamic Type does not change the layout because of the scene.
- Dark and light appearances retain sufficient contrast for all Tracker content.
- Seasonal assets do not resemble IN/OUT status, warnings, errors, or interactive controls.
- The scene never blocks a tap or changes the hit target of a control.
- The app remains understandable with all seasonal decoration disabled.

## Testing Plan

Add focused tests for:

- September, October, and non-seasonal date resolution;
- local time-zone behavior at season boundaries;
- invalid preference fallback;
- `Automatic`, `Off`, and `Seasonal` settings;
- Reduce Motion selecting the static path;
- app background and screen blur stopping or pausing the scene;
- the seasonal scene being accessibility-hidden and non-interactive;
- the iOS UI-purity checker accepting only the documented seasonal exception.

Perform manual device checks for visual overlap, smallest supported iPhone layout, dark mode, Reduce Motion, VoiceOver, cold startup, warm resume, and IN/OUT response.

## Rollout

1. Implement the resolver and static September theme without animation.
2. Add the isolated Reanimated leaf scene behind the Tracker.
3. Validate performance and accessibility on device.
4. Add October bats and ghosts using the same scene primitives.
5. Add the remaining seasonal definitions only after the first two themes establish a stable asset and motion language.

The existing static color themes remain the fallback for unsupported states, disabled seasonal animation, Reduce Motion, and any rendering failure.
