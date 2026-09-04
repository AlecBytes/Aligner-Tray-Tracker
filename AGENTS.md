# AGENTS.md

# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

https://docs.expo.dev/versions/v57.0.0/sdk/ui/swift-ui/

## Project

Aligner Tracker is a performance-first, utility-first aligner tracking app.

Architecture and product requirements are documented in:

- docs/mvp-plan.md

## Core principles

- Performance and utility are the primary product goals.
- Privacy and user-centric policy are secondary goals.
- Mobile functionality is local-first.
- SQLite is the source of truth on the device.
- Normal tracker actions must not require network access.
- Prefer simple implementations and minimal dependencies.
- Do not add features that are outside the current task.

## Stack

Frontend:
- React Native
- Expo
- TypeScript
- Expo Router
- SQLite

Planned cloud services (not yet implemented):
- Supabase
- Sign in with Apple
- Cloud Backup & Restore before any multi-device sync work

See `docs/features/cloud-backup-restore.md` and `docs/features/cloud-sync-future.md` before planning cloud work. Do not implement sync until its unresolved product decisions are documented.

## Working style

Before implementing a feature, read only the relevant portion of
docs/mvp-plan.md.

Do not implement future roadmap features unless explicitly requested.

## SQLite Mutation Transactions

- Follow the transaction policy in `docs/sqlite-transactions.md` when adding or changing SQLite writes.
- Keep single-statement mutations atomic in SQL where practical.
- On native platforms, user-initiated multi-step SQLite mutations must use `withExclusiveTransactionAsync` so unrelated app queries cannot join the transaction.
- Execute every query in a multi-step mutation through the transaction-scoped connection passed into the operation; do not fall back to the shared database connection inside the transaction.
- `withExclusiveTransactionAsync` is not supported on web, so preserve a scoped `withTransactionAsync` fallback there when the same repository is shared across platforms.
- Migration transactions run during `SQLiteProvider` initialization before app consumers receive the database and may continue using `withTransactionAsync`.
- Prefer database constraints for critical cross-record invariants when SQLite can enforce them cheaply.

## UI and Layout Conventions

- Screen scrolling must be intentional.
- Compact core-action screens should fit within the usable viewport and should not scroll.
- Forms and content-heavy screens may scroll when needed, especially for keyboard accessibility.
- Multi-field forms should keep the focused input visible and provide natural Next/Done navigation where appropriate.
- Respect safe areas and prefer the platform-native Expo layout and keyboard APIs before adding dependencies.

### Form Controls

- Prefer native constrained controls such as `Picker`, `DatePicker`, and `Toggle` over free-form text input when the value has a sensible bounded domain.
- Text fields with Return-capable keyboards should use standard Next/Done submit behavior where appropriate.
- Numeric and decimal keyboards do not require a custom Previous/Next/Done accessory.
- Do not add custom native keyboard infrastructure unless a concrete product requirement cannot be met with Expo UI SwiftUI controls.

## iOS UI Purity

- All app-owned visible iOS UI, including shared components reached by Expo Router routes or `.ios.tsx` modules, must use `@expo/ui/swift-ui`.
- Do not use React Native visual or presentation primitives in the iOS app graph. This includes `View`, `Text`, `Pressable`, `TextInput`, `Switch`, `ScrollView`, `FlatList`, `SectionList`, `ActivityIndicator`, `Touchable*`, `SafeAreaView`, and `StyleSheet`.
- The Expo UI `Host` and its outer sizing style are the approved SwiftUI bridge. Expo Router/native navigation and status-bar infrastructure are also allowed.
- React Native runtime imports on iOS are limited to approved non-visual platform APIs such as `Linking`, `AppState`, `Platform`, and `useColorScheme`. Add another API to the validation allowlist only when it is verified to be non-visual.
- Keep `npm run check:ios-ui-purity` in the project validation suite. The guard must resolve shared runtime dependencies, not only inspect `.ios.tsx` files directly.
