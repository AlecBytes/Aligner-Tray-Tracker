# Themes

## Confirmed free-feature decision — 2026-09-14

Themes are a free, local-first feature for every user. Current color themes and all future Seasonal, Animated, or other theme variants must remain available without a purchase, subscription, RevenueCat entitlement, app account, or network connection.

The current implementation target is iPhone. Themes must be visible and functional in every iOS build configuration, including development, preview, and production when paid access is disabled. Android and web remain unsupported product targets; their theme UI parity is deferred with the rest of those platforms.

## Current color themes

Menu → Themes opens a native, scrollable list. Show Default first, followed by Blue, Teal, Green, Orange, and Pink. Each row includes its name, a color swatch, and an accessible selected or available state.

Selecting any theme applies it immediately and saves it locally without a separate Save button. If persistence fails, return to the previous selection and show a retryable error. The screen must not show locked states, Pro messaging, purchase controls, Restore Purchases, or Manage Subscription.

Follow system light/dark appearance; do not add an appearance-mode setting. Preview means swatches and a small static sample within the Themes screen.

Use stable keys: `default`, `blue`, `teal`, `green`, `orange`, `pink`.

| Key | Light primary | Light pressed | Light onPrimary | Dark primary | Dark pressed | Dark onPrimary |
|---|---|---|---|---|---|---|
| default | #580FBD | #430A96 | #FFFFFF | #9955FF | #8040E6 | #171020 |
| blue | #0047AB | #003887 | #FFFFFF | #4D85FF | #336DE6 | #071126 |
| teal | #00859A | #006D80 | #FFFFFF | #45D6E8 | #20BACE | #071A20 |
| green | #4CBB17 | #3E9B12 | #0B1C12 | #6CDB32 | #55BD20 | #0B1C12 |
| orange | #FF9500 | #E58300 | #211207 | #FFAD33 | #FF9500 | #211207 |
| pink | #FF1493 | #E6007E | #24101B | #FF4DB3 | #FF1493 | #24101B |

Previously saved Purple selections fall back to the purple Default palette. Missing or invalid keys also resolve to Default.

All themes share the current neutral tokens:

| Token | Light | Dark |
|---|---|---|
| background | #F7F8FA | #0B0E14 |
| surface | #FFFFFF | #151A23 |
| text | #111827 | #F5F7FA |
| textMuted | #5F6B7A | #A9B2C1 |
| border | #D8DEE8 | #303846 |
| error | #B42318 | #FFB4AB |

Prefer native semantic labels, backgrounds, materials, disabled states, and role-based colors when controls supply them. Custom primary-filled controls use the matching onPrimary. Errors, destructive actions, warnings, success, IN/OUT meaning, and graph-series identity must not become arbitrary theme accents.

Scope covers iPhone app-owned screens, including setup, tracker, menu, forms, history/statistics, and any paid-access UI. It does not recolor the icon, launch screen, Apple purchase sheet, Watch app, widgets, or exported/shared images.

## Persistence and runtime behavior

Persist one `selectedThemeKey` in the existing local app-settings infrastructure. No theme-specific tables, treatment schema changes, or theme records in wear history are needed.

The effective theme is always the valid locally selected theme plus the current system appearance. Theme resolution must not read billing state or wait for RevenueCat. An existing saved color becomes effective immediately after an upgrade from an entitlement-gated version, including offline and in production builds with `EXPO_PUBLIC_PAID_ACCESS_MODE=disabled`.

Theme preferences remain device-local and are not included in cloud treatment backups or synchronized. Reset App returns the preference to Default through the existing settings reset.

Initialize and render themes without blocking the splash screen, SQLite loading, or tracker interactions beyond the existing local preference read. Never send theme choices or treatment data to RevenueCat.

## iOS presentation and verification

All app-owned iOS visuals must use Expo UI / SwiftUI and retain the iOS UI-purity gate. Verify:

- all six palettes in light and dark mode;
- selection and restart persistence in every iOS build configuration;
- offline use with paid access disabled or unavailable;
- invalid-key fallback and failed-write rollback;
- Dynamic Type, VoiceOver labels, and sufficient contrast;
- no locked state, purchase control, paywall route, or Pro copy on the Themes screen;
- normal startup, resume, IN/OUT, and tray-change performance remains within existing budgets.

## Future phases

Seasonal themes and Animated themes remain separate future implementation projects. Their exact palettes, scheduling, static fallbacks, Reduce Motion behavior, and performance budgets must be specified before implementation. They and any other future theme variants are free features and must not depend on `aligner_tray_tracker_pro` unless a later explicit product decision supersedes this document.
