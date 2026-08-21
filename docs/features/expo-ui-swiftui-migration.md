# Expo UI / SwiftUI Migration

## Status

Implementation complete as of 2026-08-20. Every implemented feature screen, shared loading state, and treatment route-gate state now resolves to an `@expo/ui/swift-ui` implementation on iOS. Expo Router remains the navigation shell, and the existing React Native files remain non-iOS fallbacks.

Manual testing on physical/simulated iPhones across the supported OS and accessibility ranges is still required before release. The code, static validation, native project generation, and iOS production bundle gates are complete.

## Completion Record

### Migrated iOS Presentation

- Treatment Setup
- Treatment Plan
- Notifications
- Menu
- Account
- Help
- Treatment Plan History
- Statistics
- Edit In/Out Times: Date History, Daily Punch History, Edit Event, and Add Missing Time
- Support Aligner Tracker
- Change Tray
- Main Tracker
- Shared loading state and treatment route-gate loading/error state

The implementations use platform-resolved `.ios.tsx` files. This keeps the established Expo Router routes and preserves the current React Native screens as Android/web fallbacks without mixing React Native views into the SwiftUI screen trees.

### Shared Expo UI Composites

`src/components/expo-ui-components.tsx` contains the small repeated app vocabulary used by migrated iOS screens:

- `ActionButton`
- `NavigationRow`
- `ValidationMessage`
- `MetricRow`
- `CenteredState`
- the centralized iOS 26 Liquid Glass availability choice

`src/components/app-loading-screen.ios.tsx` is the shared native `ProgressView` loading presentation. Screen-specific native summaries and the large Tracker status control remain local to the features that own them rather than becoming generic wrappers.

### Final iOS UI Purity Audit

The final platform-resolved audit covered every Expo Router route and every app-owned `.ios.tsx` override, then followed their runtime imports into shared components, services, repositories, and theme code. It reached 63 app-owned modules from 35 iOS route/override roots, including `src/components/expo-ui-components.tsx`.

No React Native visual primitive or `StyleSheet` presentation violation was found in the reachable graph. The production iOS source map independently confirms that every feature route selects its `.ios.tsx` implementation and that the generic React Native screen/helper fallbacks are absent from the bundle.

`npm run check:ios-ui-purity` now enforces this boundary. It performs iOS-aware module resolution, traverses app-owned runtime imports, and permits only the current non-visual React Native allowlist: `Linking`, `AppState`, `Platform`, and `useColorScheme`. Default, namespace, wildcard, CommonJS, dynamic, React Native subpath, `SafeAreaView`, or other React Native runtime access fails validation. Type-only imports do not affect the rendered dependency graph.

### Compatibility and Intentional Exceptions

- Expo SDK 57's generated iOS project uses deployment target 16.4 by default. A clean `expo prebuild --platform ios --no-install` check produced `IPHONEOS_DEPLOYMENT_TARGET = 16.4`; no build-properties dependency or native project override is needed.
- iOS 26+ buttons use `glass` or `glassProminent` where appropriate. iOS 16.4–25 receives `bordered` or `borderedProminent` from the same shared style decision; behavior and routing do not branch by OS version.
- No custom Swift view or local Expo module was added.
- Expo UI `Host` is the required React Native-to-SwiftUI bridge. Its outer `flex: 1` sizing style only sizes that boundary; all app-owned visible descendants are Expo UI SwiftUI views.
- React Native remains only at non-visual application/service boundaries on iOS: `Linking` for email/device settings, `AppState` for notification lifecycle work, `Platform` for OS capability decisions, and `useColorScheme` for theme selection. Expo Router/native navigation and Expo's status-bar component remain infrastructure exceptions. No migrated iOS screen renders a React Native visual primitive.
- Generic React Native UI helpers and screens remain because they are still the explicit non-iOS fallbacks. They are not selected by the iOS bundle and are therefore not dead code.
- Long-history list profiling, VoiceOver, Dynamic Type extremes, reduced transparency, dark mode, keyboard ergonomics, and smallest-iPhone layout checks remain manual release gates.

### Automated Verification

- `npm run validate`: passed (`typecheck`, lint, iOS UI purity graph check, 22 test suites, and 121 tests)
- `npm run check:ios-ui-purity`: passed across 63 app-owned modules reached from 35 iOS route/override roots
- Expo lint emits an environment warning because the active shell is using Node 20.10.0; the project declares Node 22.13.0 or later
- Clean Expo iOS native project generation with no dependency install: passed; deployment target 16.4 verified
- `expo export --platform ios --source-maps`: passed and produced a Hermes iOS production bundle; the source map resolves every feature screen and the route gate to its `.ios.tsx` implementation and contains none of the fallback `AppScreen`, `AppText`, form-keyboard, treatment-field, or text date/time UI modules

## Goals and Constraints

- iOS is the primary platform.
- The minimum supported iOS version is 16.4.
- Android compatibility is not required for this migration.
- `@expo/ui/swift-ui` becomes the primary iOS UI layer.
- Use native SwiftUI components exposed by Expo UI wherever possible.
- Keep Expo Router and the existing route structure for navigation.
- Preserve SQLite as the on-device source of truth.
- Preserve repositories, domain models, validation, calculations, notification policy, and other business logic. This is a UI-layer migration.
- Prefer Expo UI composition over custom Swift views or custom Expo modules.
- Keep app-specific components small, semantic, and few. Do not rebuild a general-purpose design system on top of Expo UI.
- Preserve intentional scrolling: the compact Tracker and Change Tray screens should fit the usable viewport without scrolling; forms and content-heavy screens may scroll.

## OS Appearance Contract

The app has one information architecture and interaction model across all supported iOS versions.

### iOS 26 and Later

- Use native Liquid Glass button styles and effects where they suit the control hierarchy, especially prominent actions, compact navigation controls, and overlays.
- Prefer Expo UI `buttonStyle('glass')`, `buttonStyle('glassProminent')`, and `glassEffect` rather than imitating glass with custom colors, blur, or gradients.
- Do not apply glass indiscriminately to every section or card. Native `Form`, `List`, and `Section` presentation should remain the foundation.
- Respect accessibility settings such as reduced transparency and rely on the native fallback behavior where available.

### iOS 16.4 Through 25

- Use compatible native SwiftUI styles such as `bordered`, `borderedProminent`, standard `Form`/`List` sections, native materials, and system backgrounds.
- Preserve the same content order, dimensions needed for usability, enabled/disabled states, tap targets, navigation, validation, and confirmation behavior as the iOS 26+ presentation.
- Glass is progressive styling, not a feature or behavior branch.

Centralize the small OS-dependent style choice so individual screens do not contain scattered version checks.

## Architecture Boundary

Expo Router continues to provide stacks, route parameters, links, back behavior, and route gates. Each migrated screen crosses into SwiftUI through an Expo UI `Host`. Layout inside a `Host` uses SwiftUI primitives such as `VStack`, `HStack`, `Spacer`, `Form`, `List`, and `ScrollView`; the Host's outer sizing style is the only app-owned React Native layout boundary on iOS.

Screen components may continue to load and mutate data through the existing TypeScript hooks and SQLite repositories. Expo UI controls receive display values and invoke existing actions. Do not move business rules into Swift or duplicate them in the UI layer.

Prefer a self-contained SwiftUI tree per screen. Do not add app-owned React Native visual interop to the iOS dependency graph. Follow the custom-native work policy if a verified Expo UI capability gap cannot be resolved through native Expo UI composition.

## Native Input Control Decision

Prefer `Picker`, `DatePicker`, and `Toggle` over `TextField` when the domain already defines a bounded, reasonably enumerable set, a date/time value, or a boolean value. A numeric type or theoretical machine limit does not by itself make a value reasonably enumerable. Do not invent a product limit or numeric step only to make a picker possible. Keep a `TextField` when current validation accepts an effectively unbounded positive number or arbitrary numeric precision, so the UI does not narrow the domain model.

## Shared Component Migration Map

| Current UI | Expo UI / SwiftUI replacement | Migration direction |
| --- | --- | --- |
| `AppScreen` | `Host` containing `Form`, `List`, `ScrollView`, or `VStack`; `Spacer` and frame/padding modifiers for compact layouts | Replace with a thin screen-host boundary. Let Expo Router and native containers handle safe areas and keyboard avoidance where possible. Keep scrollability explicit per screen. |
| `AppLoadingScreen` | `Host`, `VStack`, `ProgressView`, and `Text` | Keep one small shared loading-state composite. |
| `AppText` | Expo UI `Text` with native font and `foregroundStyle` modifiers | Do not recreate every old text variant. Use native semantic styles directly; retain at most small helpers for repeated timer/metric typography. |
| React Native `Pressable` | Expo UI `Button`; Expo Router `Link` with `asChild` for navigation; `buttonStyle`, `tint`, `disabled`, and control-size modifiers | Replace generic pressable styling with native button semantics. Custom button children may use `HStack`, `VStack`, `Label`, `Image`, and `Spacer`. |
| React Native `TextInput` | Expo UI `Picker`, `DatePicker`, `Toggle`, or `TextField`, according to the value's domain | Prefer constrained native controls for bounded or semantic values: `Picker` for a reasonably enumerable set, `DatePicker` for dates/times, and `Toggle` for booleans. Keep `TextField` when validation permits an unbounded range or arbitrary numeric precision; use native keyboard types, submit labels, focus refs, and validation presentation there. |
| React Native `Switch` | Expo UI `Toggle` | Use the native label and switch semantics rather than a custom row plus switch. |
| Hand-styled form groups | `Form` and `Section` | Use section headers, footers, validation text, and native grouped appearance. |
| Hand-styled cards | `Section`, `List` rows, or a small `VStack`/`HStack` with native background, padding, and shape modifiers | Prefer native grouping. Keep a card composite only when it conveys app-specific summary information. |
| Row chevrons and status marks | `Label`, SF Symbol `Image`, `HStack`, and `Spacer` inside `Button`/`Link` | Keep one small navigation-row composite if repetition justifies it. |
| Inline confirmation panels | Expo UI `Alert` or `ConfirmationDialog` | Use native confirmation presentation unless inline context is necessary for comprehension. |
| `ActivityIndicator` | `ProgressView` | Use within loading screens and pending product rows. |

## Minimal App-Specific Composites

The completed migration keeps only repeated app vocabulary as shared composites:

- `ActionButton`: version-aware prominent/secondary native actions with pending state.
- `NavigationRow`: a plain native row button with label, optional secondary value or SF Symbol, and chevron.
- `ValidationMessage`: consistent inline error text and accessibility label.
- `MetricRow`: leading label and trailing tabular value.
- `CenteredState`: repeated full-screen unavailable/retry presentation inside a `Host`.
- `AppLoadingScreen` on iOS: centered `ProgressView` plus message.

Plan-version summaries, statistics summaries, date/time picker groups, and the Tracker status control are feature-local compositions because they are not reused broadly. `Host`, `Form`, `Section`, `TextField`, and the other Expo UI primitives are used directly rather than hidden behind equivalent wrappers.

## Implemented Screen Map

### Treatment Setup

Current UI: `Host` + `Form`, three numeric/decimal `TextField` inputs, a native Starting Tray `Picker`, inline validation/errors, and a prominent Start Tracking button. Starting Tray falls back to a native numeric `TextField` only when Total Trays exceeds 200, because enumerating an effectively unbounded valid plan would violate the reasonably-enumerable rule and the app's performance goal. This fallback does not narrow validation or the domain model.

Migration:

- `Host` + `Form` + `Section`
- Native menu-style `Picker` for Starting Tray, constrained dynamically to `1...Total Trays`, while the range remains reasonably enumerable; a numeric `TextField` preserves unusually large valid plans without creating hundreds of thousands of native options
- `TextField` for Total Trays and Days Per Tray because their validation accepts any positive safe integer and provides no reasonable upper bound
- Decimal `TextField` for Prescribed Hours Per Day because validation accepts arbitrary precision in `(0, 24]`; a picker step would narrow existing valid input
- `keyboardType`, `submitLabel`, `onSubmit`, and imperative `TextField` refs for the remaining text fields where supported
- Native `Button` with prominent styling; `glassProminent` on iOS 26+ and `borderedProminent` on iOS 16.4–25
- `ProgressView` or a disabled saving label during submission
- Inline `ValidationMessage` for field and persistence errors

This is the first migration screen because it proves form state, validation, constrained native selection, numeric keyboards where the domain remains open-ended, scrolling, SQLite submission, route replacement, dark mode, and old-iOS styling with limited UI complexity.

### Treatment Plan

Current UI: a three-field edit form, View Plan History navigation row, loading/retry states, inline errors, and Save Changes.

Migration:

- `Host` + `Form` with separate plan, history, and action `Section` groups
- `NavigationRow` wrapped by Expo Router `Link` for Plan History
- Three native numeric/decimal `TextField` controls with shared validation conventions
- Native save and retry `Button` controls
- `ProgressView`, inline validation, and existing save/dismiss behavior

Keep treatment-plan version creation and notification reconciliation unchanged.

### Treatment Plan History

Current UI: scrollable version cards containing effective time, Current badge, and plan values.

Migration:

- `Host` + `List` or `Form`
- A `Section` or `PlanVersionSummary` for each version
- `HStack`, `VStack`, `Text`, `Spacer`, and a capsule-style Current badge
- `MetricRow` for total trays, days per tray, and prescribed hours
- `ProgressView` and native retry button for loading/error states

The number of versions is expected to remain modest. Verify list mount performance because Expo UI `List` in SDK 57 creates all rows up front.

### Tracker

Current UI: a non-scrolling custom layout with menu access, tray summary, a dominant IN/OUT action, live IN/OUT metrics, error messaging, and Change Tray.

Migration:

- Full-screen `Host` + `VStack`; `HStack` for metrics and top actions; `Spacer`/frame modifiers to preserve the compact viewport layout
- Native `Text` with tabular-number typography for tray and timers
- `TrackerStatusControl` as a large native `Button` with custom Expo UI child content
- Two small metric-summary composites built from native stacks and text
- Native menu and Change Tray buttons, using Liquid Glass styles on iOS 26+ and bordered fallbacks on earlier versions
- Existing one-second display refresh, SQLite state transitions, error recovery, and notification reconciliation remain in TypeScript

Migrate this screen last. It is the most visually specialized and highest-frequency screen. Do not create a Swift module for it initially; first prove that Expo UI layout, button hit areas, accessibility labels, tabular timers, and render cadence meet the performance and usability bar.

### Change Tray

Current UI: non-scrolling Previous/Next actions, numeric manual entry, Select, an inline confirmation card, error states, and Back to Tracker.

Migration:

- Full-screen `Host` with `VStack`, or a compact `Form` only if it still fits without scrolling
- `ControlGroup` or `HStack` containing native Previous and Next `Button` controls
- Numeric `TextField` plus Select `Button`
- Expo UI `Alert`/`ConfirmationDialog` for the IN-versus-OUT confirmation copy and Cancel/Confirm actions
- Native back action through Expo Router

Keep tray validation, pending selection, transaction behavior, and notification reconciliation unchanged.

### Notifications

Current UI: permission-status card, device-settings action, two reminder sections, two switches, numeric OUT duration input, text-formatted reminder time input, save feedback, and Save Changes.

Migration:

- `Host` + `Form` + `Section`
- Expo UI `Toggle` for both reminder switches
- Numeric `TextField` for OUT reminder minutes
- Native `DatePicker` with `hourAndMinute` for tray-change reminder time instead of a free-form time string, while preserving the stored hour/minute model
- Native Button for device settings and save; continue using the existing linking and notification APIs
- Section footer or inline `Text` for permission state and validation

The permission request and pending-notification reconciliation remain outside the UI layer.

### Edit In/Out Times — Date History

Current UI: current-week day rows plus expandable previous-week groups.

Migration:

- `Host` + `List` with `Section` groups
- Native navigation rows for current-week days
- Expo UI `DisclosureGroup` for previous weeks, containing day navigation rows
- Expo Router links retain the current date route parameter
- `ProgressView` and native retry state

Verify performance with a long treatment history because SDK 57 Expo UI `List` does not lazily create React rows. Keep collapsed weeks cheap and optimize the native composition or data window if profiling finds a problem; a React Native visual fallback is not an approved iOS exception.

### Edit In/Out Times — Daily Punch History

Current UI: dated title, event rows showing time and IN/OUT status, empty/error states, and Add Missing Time.

Migration:

- `Host` + `List` or `Form`
- `Section` for events
- `NavigationRow` with tabular time, status, and chevron
- Native prominent Button for Add Missing Time
- Continue setting the Expo Router screen title from the route date

### Edit In/Out Times — Edit Event

Current UI: read-only status card, text date/time fields, inline validation, and Save Correction.

Migration:

- `Host` + `Form`
- Read-only status `Section`
- `DateTimeFieldGroup` using native `DatePicker` controls for date and time
- Native save button and validation text

Convert picker values to timestamps at the existing application boundary. Keep ordering, alternation, conflict, and tray-period validation in the current domain/repository code.

### Edit In/Out Times — Add Missing Time

Current UI: IN/OUT radio-style choice, four text date/time fields for start/end, error messaging, and Add Missing Time.

Migration:

- `Host` + `Form`
- Expo UI `Picker` with segmented style for IN/OUT
- Start and End `Section` groups using native `DatePicker` controls
- Native prominent save button and inline validation

Keep the atomic two-transition repository operation and correction validation unchanged.

### Statistics

Current UI: Current Tray and Treatment Overall summary cards plus seven Recent Day cards.

Migration:

- `Host` + `List` or `Form`
- `Section` for Current Tray, Treatment Overall, and Recent Days
- `StatisticsSummary` and `MetricRow` composites built from `HStack`, `VStack`, `Text`, and `Spacer`
- Native status text or SF Symbol for goal met/not met
- `ProgressView` and retry button for unavailable states

No chart component is needed. Keep statistics local, read-only, and derived from existing source data.

### Menu

Current UI: a list of navigation pressables for Account, Treatment Plan, Notifications, Edit In/Out Times, Statistics, development-only Support, and Help.

Migration:

- `Host` + native `List`/`Section`
- Expo Router `Link` with a plain native `Button`/`NavigationRow`
- `Label` and SF Symbols where they improve scanning; retain text labels and chevrons
- Preserve the development-only visibility rule for Support

Do not introduce a custom drawer or replace Expo Router.

### Support

Current UI: optional-support explanation, product rows with price and processing state, retry/success/cancel/failure states, and support-again action.

Migration:

- `Host` + `Form` or `List` with explanation, product, and policy `Section` groups
- Native `Button` rows for products, with title and price in an `HStack`
- `ProgressView` for load and purchase progress
- Native alert or section-level status feedback where appropriate

Keep the purchase-service abstraction and state reducer unchanged. The UI migration does not add or choose a production purchase provider.

### Account

Current UI: informational intro and two cards explaining on-device mode and future accounts.

Migration:

- `Host` + `Form`/`List`
- Native informational `Section` groups with `Text`, `Label`, and system styling
- No sign-in controls until the account feature is actually implemented

### Help

Current UI: four numbered Getting Started steps and a support email action with fallback error text.

Migration:

- `Host` + `List`/`Form`
- Getting Started `Section` with a small numbered-step row composite made from `HStack`, native `Text`, and a system shape/background
- Support `Section` with a native `Button` or `Link` for the email address
- Keep the existing email-opening behavior and copyable-address/error fallback

## Capability Verification Gates

### Native Form Input Convention

- Prefer `Picker`, `DatePicker`, `Toggle`, and other native controls whenever a value is constrained by the domain.
- Use `TextField` for values that are genuinely open-ended or cannot be represented by a reasonable native selection control.
- For keyboards that expose Return, use Expo UI `submitLabel` and `onSubmit` and focus the next field where appropriate.
- Numeric and decimal keyboards do not require a custom Previous/Next/Done accessory.
- Do not add a custom native keyboard module to provide accessory controls for this behavior.

### Additional Verification

- Confirm the SDK-compatible `@expo/ui` version at implementation time and set the iOS deployment target to 16.4.
- Verify native state bridging and validation updates without requiring an unnecessary worklet dependency.
- Verify field error announcements, save-result announcements, VoiceOver order, Dynamic Type, and minimum tap targets with Expo UI. Use a small custom accessibility modifier only if no Expo UI/native composition provides the required behavior.
- Verify Expo Router header appearance and transitions around full-screen SwiftUI hosts on both OS ranges.
- Verify `Form`/`List` scrolling, keyboard dismissal, and focused-field visibility.
- Verify the appearance-selection mechanism for Liquid Glass and its behavior with reduced transparency. All glass-only APIs must be gated from iOS 16.4–25.
- Profile the non-lazy Expo UI `List` behavior for Treatment Plan History and long Edit In/Out Times histories.
- Verify the custom Tracker layout on the smallest supported iPhone viewport before replacing the existing tracker.

## Custom Native Work Policy

No custom SwiftUI component or local Expo module is required by the current plan.

Potential native work is limited to verified gaps:

- a narrowly scoped accessibility modifier, only if native announcements or field-error association cannot be achieved through Expo UI;
- a narrowly scoped Tracker view only if Expo UI composition demonstrably fails the layout, accessibility, or performance requirements after the common patterns are proven.

For list performance, first optimize the Expo UI composition, collapsed content, and data window. For styling differences, use native version-appropriate modifiers rather than custom Swift. Any new native implementation requires a verified Expo UI gap and an explicit update to this policy; React Native visual fallback screens are not an iOS option.

## Incremental Migration Order

1. [x] **Treatment Setup** — `Host`, `Form`, bounded `Picker`, numeric `TextField`, validation, SQLite submission, route replacement, and version-aware styling.
2. [x] **Treatment Plan** — form fields, navigation row, existing-value loading, save/dismiss behavior, and plan history entry.
3. [x] **Notifications** — `Toggle`, numeric input, native time `DatePicker`, permission messaging, and settings linking.
4. [x] **Menu, Account, and Help** — native lists/forms, navigation rows, informational sections, SF Symbols, and email actions.
5. [x] **Treatment Plan History and Statistics** — summary sections, metric rows, current/goal status, loading states, and read-only lists.
6. [x] **Edit In/Out Times** — disclosure groups, routed rows, segmented choice, native date/time pickers, and correction forms. Collapsed weeks omit day-row children; long-history device profiling remains manual.
7. [x] **Support** — product rows and asynchronous progress/status presentation with the purchase abstraction unchanged.
8. [x] **Change Tray** — compact non-scrolling layout, manual numeric entry, adjacent controls, and native confirmation dialog.
9. [x] **Main Tracker** — non-scrolling native stack layout, large expandable IN/OUT control, live metrics, local state transitions, errors, routing, and OS-version styles.

The code migration is complete in this order. Manual iPhone smoke testing remains required before removing or reconsidering the non-iOS fallbacks.

## Acceptance Criteria

- All implemented screens have a native Expo UI / SwiftUI presentation on iOS.
- iOS 26+ uses appropriate Liquid Glass presentation; iOS 16.4–25 uses compatible native fallbacks with equivalent layout and behavior.
- Expo Router navigation and route parameters continue to work.
- SQLite data and all existing domain behavior remain unchanged.
- Core tracker actions remain local-first, immediate, and network-independent.
- Compact core-action screens do not scroll; forms and history screens scroll intentionally.
- VoiceOver, Dynamic Type extremes, dark mode, keyboard behavior, and loading/error states still require manual verification across the supported OS range.
- Custom components remain limited to the small app-specific composites listed above.
- No custom native module is added without a documented Expo UI capability gap.

## Official Expo SDK 57 References

- [Expo UI SwiftUI overview](https://docs.expo.dev/versions/v57.0.0/sdk/ui/swift-ui/)
- [Building SwiftUI apps with Expo UI](https://docs.expo.dev/guides/expo-ui-swift-ui/)
- [Expo UI Form](https://docs.expo.dev/versions/v57.0.0/sdk/ui/swift-ui/form/)
- [Expo UI List](https://docs.expo.dev/versions/v57.0.0/sdk/ui/swift-ui/list/)
- [Expo UI Picker](https://docs.expo.dev/versions/v57.0.0/sdk/ui/swift-ui/picker/)
- [Expo UI TextField](https://docs.expo.dev/versions/v57.0.0/sdk/ui/swift-ui/textfield/)
- [Expo UI DatePicker](https://docs.expo.dev/versions/v57.0.0/sdk/ui/swift-ui/datepicker/)
- [Expo UI modifiers](https://docs.expo.dev/versions/v57.0.0/sdk/ui/swift-ui/modifiers/)
- [Extending Expo UI with SwiftUI](https://docs.expo.dev/guides/expo-ui-swift-ui/extending/)
