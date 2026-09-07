# Premium Support

## Purpose

Provide Aligner Tracker Pro users with a simple priority email support channel that offers faster triage and more personal troubleshooting without weakening standard support for free users.

Premium Support is a paid service benefit, not a core tracking feature. It must remain isolated from the local tracker and must not introduce a backend, account requirement, ticketing system, or network dependency on normal app flows.

---

## Product Decision

Premium Support is included in the existing app-wide paid access controlled by the RevenueCat entitlement:

`aligner_tray_tracker_pro`

It does not use a separate subscription, purchase, or entitlement.

All monthly, annual, and lifetime Pro purchases receive the same Premium Support access according to the access lifecycle defined in `paid-access.md`.

Free users retain ordinary support contact. Premium Support adds priority handling; it does not intentionally degrade or remove standard support.

---

## User-Facing Positioning

Recommended language:

> **Premium Support**
>
> Get priority help directly from the developer.
>
> Pro members receive priority email support, faster response handling, and more personalized troubleshooting.

Do not promise a fixed response-time SLA such as "within 24 hours" unless a separate future product decision explicitly establishes one.

Use wording such as:

> Premium Support requests are prioritized ahead of standard support requests.

This communicates a real benefit without creating an unsupported service guarantee.

---

## Navigation

Place Premium Support under Help rather than on the main Tracker or as a separate top-level menu destination.

Recommended flow:

```text
Menu
  ↓
Help
  ├─ Getting Started
  ├─ Contact Support
  └─ Premium Support   PRO
```

Premium Support should remain discoverable to non-Pro users with a small Pro indicator.

Do not place promotional banners, popups, or Premium Support solicitation on the Tracker.

---

## Non-Pro Behavior

When a user without active Pro access selects Premium Support:

1. Explain the benefit briefly.
2. Make clear that standard support remains available.
3. Offer the existing Aligner Tracker Pro purchase flow.
4. Allow the user to return to Help without friction.

Do not block or obscure the ordinary Contact Support option.

Suggested copy:

> Premium Support is included with Aligner Tracker Pro. Pro requests receive priority handling and more personalized troubleshooting. Standard support remains available to everyone.

Do not implement a second Premium Support-specific paywall or purchase system. Reuse the shared paid-access flow.

---

## Pro Behavior

When the user has valid `aligner_tray_tracker_pro` access:

1. Show the Premium Support screen.
2. Present a clear **Contact Premium Support** action.
3. Open the device's email composer or email application using the configured Aligner Tracker support address.
4. Prefill the subject so premium requests are easy to identify and prioritize.

Recommended subject:

`Aligner Tracker Pro Support`

Use the same configured support inbox unless there is a later operational reason to maintain a separate Pro-only address. The priority subject is sufficient for V1 triage and avoids introducing another operational dependency.

The actual support email address is a release/configuration input and must not be invented by implementation agents.

---

## Email Body

The prefilled email body may include small, visible, editable diagnostic context that helps troubleshooting:

```text
App version: <version>
iOS version: <version>
Device: <model>

How can I help?
```

The user must be able to review and edit the email before sending.

Do not automatically include or attach:

- treatment history
- tray history
- wear punches
- statistics
- cloud backup contents
- RevenueCat customer identifiers
- Supabase identifiers
- account tokens
- diagnostic logs
- advertising identifiers

If richer diagnostics are desired later, specify them as a separate feature and obtain an explicit user action before attaching treatment or diagnostic data.

---

## Email Failure / No Mail App

Do not add a mail or support SDK solely for this feature.

Prefer existing platform linking/composer capabilities.

If the device cannot open an email composer:

- keep the configured support email address visible
- provide a simple Copy Email action where practical
- show a concise message explaining that an email app could not be opened

Premium Support should fail independently without affecting any other app area.

---

## Entitlement Behavior

Use the same entitlement state and lifecycle rules as other paid features.

- Valid monthly/annual subscription: Premium Support available while access is active.
- Valid lifetime purchase: Premium Support available permanently unless that purchase is refunded/revoked and no other valid purchase grants access.
- Subscription expiration: Premium Support returns to the non-Pro state; standard support remains available.
- Offline behavior follows the SDK-valid cached entitlement rules in `paid-access.md`.
- Cloud sign-in/sign-out must not independently grant or remove Premium Support.
- Consumable Support Aligner Tracker tips never grant Premium Support.

Do not persist a separate local `premiumSupportEnabled` flag.

---

## Architecture

V1 should require no new server-side infrastructure.

```text
Help
  ↓
Premium Support
  ↓
shared paid-access entitlement state
  ↓
active aligner_tray_tracker_pro?
  ├─ no  → Pro benefit + existing purchase flow
  └─ yes → local email/contact flow
```

Do not add:

- authentication requirements
- Supabase tables
- support ticket databases
- help-desk SDKs
- chat systems
- background services
- analytics SDKs
- polling

A future support volume problem can justify a dedicated help-desk system later. It is not required for V1.

---

## Performance

Premium Support must not enter the Tracker's critical path.

Requirements:

- no support-related network request during app startup solely for this feature
- no support-related work when recording IN/OUT punches
- no polling
- no additional SQLite persistence required
- reuse already-required paid-access entitlement state
- load the contact experience only when the user enters Help / Premium Support

---

## Privacy and User-Centric Rules

Premium Support should follow the same data-minimization principles as the rest of the app.

- The user initiates contact intentionally.
- The user reviews the email before sending.
- Treatment data is not silently transmitted.
- Standard support remains available without Pro.
- Do not imply that purchasing Pro improves the quality, reliability, or safety of the core tracker itself.
- Do not advertise Premium Support during normal tracking actions.

---

## Relationship to Support Aligner Tracker

`docs/features/support.md` describes optional consumable tips that financially support development.

Premium Support is different:

- **Support Aligner Tracker** = user gives an optional tip; no feature access is granted.
- **Premium Support** = customer-service benefit included with `aligner_tray_tracker_pro`.

Keep these concepts and purchase behaviors separate in UI and implementation.

---

## V1 Acceptance Criteria

- Premium Support appears under Help with a Pro indicator.
- Standard Contact Support remains available to free users.
- Non-Pro selection explains the benefit and can route to the shared Pro purchase flow.
- Pro selection provides a Contact Premium Support action.
- The contact action uses the configured support email address and identifies the request as Pro support.
- The email may include only visible, editable basic app/device metadata by default.
- No treatment data or internal account/purchase identifiers are attached automatically.
- Lack of an email app produces a useful fallback without affecting the tracker.
- No new backend, account requirement, database table, support SDK, or tracker-path network work is introduced.
- Consumable tips do not unlock Premium Support.

---

## Later Enhancements

Only consider these if actual support volume or user needs justify them:

- dedicated Pro support inbox
- structured issue categories
- optional user-approved diagnostic attachment
- in-app support history
- help-desk/ticketing integration
- explicit response-time SLA

These are not part of V1.
