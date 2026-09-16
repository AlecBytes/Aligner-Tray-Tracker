# Experimental 3D tray button

Branch: `experiment/tray-button-3d`.

The iOS tracker hosts a React Native button in Expo UI `RNHostView`. The rest of
its screen remains SwiftUI. This is the branch-only exception documented in
AGENTS.md; the purity validator allows only View, Text, Image and AccessibilityInfo
in the experimental adapter and continues traversing its local dependencies.

## Dependency and integration decisions

- Pin the requested `react-native-really-awesome-button` to 2.0.4. npm deprecates
  this name in favor of `@rcaferati/react-native-awesome-button`.
- Import `lib/commonjs/Button` directly: the legacy main entry eagerly loads
  themes whose color helper dereferences undefined `this` in strict mode.
  A declaration file supplies the package's existing public prop types.
- Explicitly depend on lodash.debounce 4.0.8, which the button imports but fails
  to declare as a runtime dependency. No native module is added by either package.
- Use the supported `dangerouslySetPressableProps.onPress` for activation. The
  legacy top-level onPress runs from onPressOut, including cancelled gestures;
  leave that callback empty. Its press-in/out handlers only animate the face.
- Keep progress mode off, preserve the existing tracker mutation handler, and
  pass disabled to both the animation component and its actual Pressable.
  SQLite commit, timestamp capture, haptics, sounds, Undo and Redo retain their
  existing behavior.
- Use a seven-point base. Reduce Motion removes depth movement and spring
  release; its value is read on mount and updated when the setting changes.
- Measure the SwiftUI allocation through the hosted React Native root, shrink
  the decorative image first, and keep the tracker non-scrolling.

## Validation and device review

Run `npm run validate` and `npx expo export --platform ios` from this worktree.
The screen tests render the actual legacy base button and exercise confirmed
state, pending saves, duplicate taps, timestamps, errors, history, and feedback.
A cancellation regression verifies press-out alone cannot record a punch.

Use the existing iOS development build with Metro started from this worktree
(`npm run start`). On a physical iPhone, review small-screen fit, large text,
light/dark themes, VoiceOver state/hint, Reduce Motion, cancelled drags, rapid
taps, and the press/release animation. Native visual performance and SwiftUI
hosting still require this device check; a JS bundle and tests cannot verify it.

To discard the experiment, return to the original main checkout. No database
schema or stored-data format changes are introduced.

Validation result: TypeScript, ESLint, the scoped iOS purity guard and the iOS
Hermes export pass. All 449 tests across 71 suites pass across the suite run and
a separate notification-parity run: the latter requires child processes that
time out inside this environment's sandbox, and passes outside it. Native
on-device review has not been performed in this Linux environment.
