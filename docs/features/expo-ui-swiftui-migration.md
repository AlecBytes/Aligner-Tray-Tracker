# Expo UI / SwiftUI Migration

## Status

Planned. This document describes an incremental iOS UI-layer migration of the currently implemented app.

The repository currently uses React Native views and controls. `@expo/ui` is not yet installed. Adding it, configuring the iOS deployment target, and changing app code belong to later implementation tasks.

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

Expo Router continues to provide stacks, route parameters, links, back behavior, and route gates. Each migrated screen crosses into SwiftUI through an Expo UI `Host`. Layout inside a `Host` should use SwiftUI primitives such as `VStack`, `HStack`, `Spacer`, `Form`, `List`, and `ScrollView`; React Native flexbox styling applies only outside that SwiftUI boundary.

Screen components may continue to load and mutate data through the existing TypeScript hooks and SQLite repositories. Expo UI controls receive display values and invoke existing actions. Do not move business rules into Swift or duplicate them in the UI layer.

Prefer a self-contained SwiftUI tree per screen. Avoid repeatedly nesting React Native and SwiftUI views. Use React Native interop only for a verified capability or performance gap.

## Shared Component Migration Map

| Current UI | Expo UI / SwiftUI replacement | Migration direction |
| --- | --- | --- |
| `AppScreen` | `Host` containing `Form`, `List`, `ScrollView`, or `VStack`; `Spacer` and frame/padding modifiers for compact layouts | Replace with a thin screen-host boundary. Let Expo Router and native containers handle safe areas and keyboard avoidance where possible. Keep scrollability explicit per screen. |
| `AppLoadingScreen` | `Host`, `VStack`, `ProgressView`, and `Text` | Keep one small shared loading-state composite. |
| `AppText` | Expo UI `Text` with native font and `foregroundStyle` modifiers | Do not recreate every old text variant. Use native semantic styles directly; retain at most small helpers for repeated timer/metric typography. |
| React Native `Pressable` | Expo UI `Button`; Expo Router `Link` with `asChild` for navigation; `buttonStyle`, `tint`, `disabled`, and control-size modifiers | Replace generic pressable styling with native button semantics. Custom button children may use `HStack`, `VStack`, `Label`, `Image`, and `Spacer`. |
| React Native `TextInput` | Expo UI `TextField`; `DatePicker` for actual dates/times | Use native keyboard types, submit labels, focus refs, and validation presentation. Replace string-formatted date/time entry with `DatePicker` when the domain flow allows it. |
| React Native `Switch` | Expo UI `Toggle` | Use the native label and switch semantics rather than a custom row plus switch. |
| Hand-styled form groups | `Form` and `Section` | Use section headers, footers, validation text, and native grouped appearance. |
| Hand-styled cards | `Section`, `List` rows, or a small `VStack`/`HStack` with native background, padding, and shape modifiers | Prefer native grouping. Keep a card composite only when it conveys app-specific summary information. |
| Row chevrons and status marks | `Label`, SF Symbol `Image`, `HStack`, and `Spacer` inside `Button`/`Link` | Keep one small navigation-row composite if repetition justifies it. |
| Inline confirmation panels | Expo UI `Alert` or `ConfirmationDialog` | Use native confirmation presentation unless inline context is necessary for comprehension. |
| `ActivityIndicator` | `ProgressView` | Use within loading screens and pending product rows. |

## Minimal App-Specific Composites

These are useful app vocabulary built from Expo UI primitives, not custom native views:

- `ExpoUIScreenHost`: a thin `Host` boundary with shared background/width behavior where required.
- `LoadingState`: centered `ProgressView` plus message.
- `NavigationRow`: a plain native `Button`/Expo Router `Link` with label, optional secondary value or SF Symbol, and chevron.
- `ValidationMessage`: consistent inline error text and accessibility behavior.
- `NumericFormField`: label, `TextField`, numeric/decimal keyboard configuration, disabled state, and validation message.
- `MetricRow`: leading label and trailing tabular value.
- `PlanVersionSummary`: effective date, Current badge, and three plan values.
- `StatisticsSummary`: a section containing repeated `MetricRow` values.
- `DateTimeFieldGroup`: one or two native `DatePicker` controls with domain range/validation wiring.
- `TrackerStatusControl`: the large app-specific IN/OUT action composed from `Button`, `VStack`, and native modifiers.

Do not keep generic wrappers equivalent to every Expo UI primitive. Add a composite only when it represents repeated app behavior or vocabulary.

## Implemented Screen Map

### Treatment Setup

Current UI: scrollable `AppScreen`, heading text, four numeric/decimal `TreatmentFormField` inputs, inline validation/errors, and a prominent Start Tracking button.

Migration:

- `Host` + `Form` + `Section`
- Four `NumericFormField` composites backed by Expo UI `TextField`
- `keyboardType`, `submitLabel`, `onSubmit`, and imperative `TextField` refs for field progression where supported
- Native `Button` with prominent styling; `glassProminent` on iOS 26+ and `borderedProminent` on iOS 16.4–25
- `ProgressView` or a disabled saving label during submission
- Inline `ValidationMessage` for field and persistence errors

This is the first migration screen because it proves form state, validation, numeric keyboards, focus movement, scrolling, SQLite submission, route replacement, dark mode, and old-iOS styling with limited UI complexity.

### Treatment Plan

Current UI: a three-field edit form, View Plan History navigation row, loading/retry states, inline errors, and Save Changes.

Migration:

- `Host` + `Form` with separate plan, history, and action `Section` groups
- `NavigationRow` wrapped by Expo Router `Link` for Plan History
- Three `NumericFormField` controls
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

Verify performance with a long treatment history because SDK 57 Expo UI `List` does not lazily create React rows. Keep collapsed weeks cheap; if the list becomes measurably slow, retain a React Native virtualized list for this screen rather than immediately creating native code.

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

### Numeric Keyboard Previous / Next / Done

This remains unresolved and must be verified in an implementation spike on iOS 16.4 and iOS 26.

Expo UI `TextField` documents numeric keyboard configuration, submit labels, submit handlers, focus-change callbacks, and imperative `focus()`/`blur()` refs. The Expo SDK 57 documentation does not document a SwiftUI keyboard accessory toolbar equivalent to the current React Native `InputAccessoryView` with Previous, Next, and Done controls.

Required process:

1. Implement Treatment Setup with Expo UI `TextField`.
2. Verify whether numeric and decimal keyboards can expose the exact Previous/Next/Done behavior directly through Expo UI, including moving focus, dismissing the keyboard, keeping the focused field visible, and focusing the first invalid field.
3. If Expo UI supports it, use that capability and keep the implementation in TypeScript/Expo UI.
4. If it does not, first evaluate an Expo UI composition that preserves the same user outcome without a custom module.
5. Propose a narrowly scoped local SwiftUI/Expo module only if Expo UI cannot provide the required toolbar behavior directly. Do not create a general form framework.

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

- the numeric-keyboard Previous/Next/Done accessory, if Expo UI `TextField` cannot support it directly;
- a narrowly scoped accessibility modifier, only if native announcements or field-error association cannot be achieved through Expo UI;
- a narrowly scoped Tracker view only if Expo UI composition demonstrably fails the layout, accessibility, or performance requirements after the common patterns are proven.

For list performance, prefer keeping an isolated React Native virtualized screen over writing a custom native list. For styling differences, use native version-appropriate modifiers rather than custom Swift.

## Incremental Migration Order

1. **Treatment Setup** — prove `Host`, `Form`, numeric `TextField`, validation, keyboard behavior, SQLite submission, route replacement, dark mode, Dynamic Type, and iOS-version styling.
2. **Treatment Plan** — reuse the form fields and add navigation rows, existing-value loading, save/dismiss behavior, and plan history entry.
3. **Notifications** — prove `Toggle`, numeric input, native time `DatePicker`, permission messaging, and settings linking.
4. **Menu, Account, and Help** — establish native lists, links, informational sections, SF Symbols, and email actions.
5. **Treatment Plan History and Statistics** — establish summary sections, metric rows, badges/status, loading states, and bounded read-only lists.
6. **Edit In/Out Times** — migrate disclosure groups, routed rows, segmented choice, native date/time pickers, and correction forms; profile long histories.
7. **Support** — migrate product rows and asynchronous progress/status presentation without changing the purchase abstraction.
8. **Change Tray** — prove the compact non-scrolling layout, manual numeric entry, adjacent controls, and native confirmation flow.
9. **Main Tracker** — migrate last, reusing all proven layout, button, state, accessibility, error, and OS-style patterns.

Complete and smoke-test each step before removing the corresponding React Native UI. Do not perform a single all-screens rewrite.

## Acceptance Criteria

- All implemented screens have a native Expo UI / SwiftUI presentation on iOS.
- iOS 26+ uses appropriate Liquid Glass presentation; iOS 16.4–25 uses compatible native fallbacks with equivalent layout and behavior.
- Expo Router navigation and route parameters continue to work.
- SQLite data and all existing domain behavior remain unchanged.
- Core tracker actions remain local-first, immediate, and network-independent.
- Compact core-action screens do not scroll; forms and history screens scroll intentionally.
- VoiceOver, Dynamic Type, dark mode, keyboard behavior, and loading/error states are verified across the supported OS range.
- Custom components remain limited to the small app-specific composites listed above.
- No custom native module is added without a documented Expo UI capability gap.

## Official Expo SDK 57 References

- [Expo UI SwiftUI overview](https://docs.expo.dev/versions/v57.0.0/sdk/ui/swift-ui/)
- [Building SwiftUI apps with Expo UI](https://docs.expo.dev/guides/expo-ui-swift-ui/)
- [Expo UI Form](https://docs.expo.dev/versions/v57.0.0/sdk/ui/swift-ui/form/)
- [Expo UI List](https://docs.expo.dev/versions/v57.0.0/sdk/ui/swift-ui/list/)
- [Expo UI TextField](https://docs.expo.dev/versions/v57.0.0/sdk/ui/swift-ui/textfield/)
- [Expo UI DatePicker](https://docs.expo.dev/versions/v57.0.0/sdk/ui/swift-ui/datepicker/)
- [Expo UI modifiers](https://docs.expo.dev/versions/v57.0.0/sdk/ui/swift-ui/modifiers/)
- [Extending Expo UI with SwiftUI](https://docs.expo.dev/guides/expo-ui-swift-ui/extending/)
