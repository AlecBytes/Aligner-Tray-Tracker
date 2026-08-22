# Support Aligner Tracker

## Purpose

Provide a simple, optional way for users to financially support the continued development of Aligner Tracker without reducing access to the core product.

This feature should follow the app's broader philosophy:

- performance and utility first
- privacy-conscious and user-centric
- minimal UI
- no dark patterns
- no unnecessary engagement mechanics
- no account required for core use

Support should never interfere with normal tracking.

---

## Product Philosophy

Supporting the app is completely optional.

Core functionality must remain available regardless of whether a user has ever purchased a tip or supporter product.

Do not use:

- pop-up support solicitations during normal app use
- banners on the tracker
- guilt-based messaging
- countdowns
- artificial urgency
- feature degradation for non-supporters
- repeated prompts after tray changes or other core actions

The user should encounter the support experience only when they intentionally open it.

Use the term **Support** rather than **Donation** in the product UI.

Suggested language:

> Support the continued development of Aligner Tracker.

---

# V1 — One-Time Support

The first version should support **one-time tips only**.

Do not introduce subscriptions or supporter entitlements in V1.

## Products

Offer a small set of consumable in-app purchase options.

Example intended tiers:

- Small Tip — approximately $1.99 USD
- Supporter Tip — approximately $4.99 USD
- Big Tip — approximately $9.99 USD

These should be configured as **consumable in-app purchases**.

Exact product identifiers and store pricing should be configured in App Store Connect / Google Play and RevenueCat.

The application must display the **localized product price returned by the store/RevenueCat**, not hardcoded currency strings.

Example:

```text
Support Aligner Tracker

Aligner Tracker is designed to keep its
core features simple and available to everyone.

If you find it useful, you can support
continued development.

Small Tip             $1.99
Supporter Tip          $4.99
Big Tip                $9.99

No features are locked behind a tip.
```

Displayed prices will vary by store region and currency.

---

# Purchase Behavior

When the user selects a support option:

1. Begin the platform purchase flow through RevenueCat.
2. Let Apple StoreKit or Google Play Billing handle payment confirmation.
3. On success, show a concise thank-you state.
4. On cancellation, return to the support screen without treating cancellation as an error.
5. On failure, show a simple useful message and allow retrying.

Example success message:

> Thank you for supporting Aligner Tracker.

Do not add celebratory animations or other heavy UI unless there is a clear utility benefit.

---

# V1 Product Rules

## No Feature Entitlement

One-time tips do not unlock functionality.

They are purely optional support.

Core features such as the following must remain unaffected:

- IN/OUT tracking
- tray changes
- treatment-plan management
- punch corrections
- notifications
- statistics
- treatment-plan history
- future export functionality

## No Account Requirement

A user must not need an Aligner Tracker account to make a one-time support purchase.

Platform purchase identity and RevenueCat should handle the purchase relationship.

## No Durable Tip Entitlement

Consumable tips do not create a permanent supporter entitlement.

There is no need to restore historical one-time tips as part of normal app functionality.

A tip is complete once the purchase succeeds.

Do not build application logic that depends on knowing how many historical tips a user has purchased.

---

# RevenueCat Architecture

Use RevenueCat as the purchase abstraction.

```text
Expo / React Native
        ↓
RevenueCat
        ↓
Apple StoreKit / Google Play Billing
```

RevenueCat should handle:

- iOS purchases
- Android purchases
- product/package retrieval
- localized pricing
- transaction handling
- receipt validation
- sandbox/test purchase support
- future subscription entitlement management if needed

Avoid implementing StoreKit or Google Play Billing directly unless RevenueCat no longer meets a concrete product requirement.

---

# Expo Development and Testing

Real native purchase testing requires the RevenueCat native module and platform billing systems.

Until RevenueCat is implemented, Support availability is controlled by
`EXPO_PUBLIC_SUPPORT_MODE`:

- `mock`: show the Support menu item and use the local mock purchase service
- `disabled` (or any missing/unrecognized value): hide Support and leave purchases unavailable

Local development and EAS development/preview builds use `mock`. EAS production builds use
`disabled`, so Support remains hidden in production until the real purchase implementation is
ready. The `/support` route remains in place while Support is disabled.

Use an **Expo development build** for real StoreKit / Google Play purchase testing.

RevenueCat's Expo Go preview/mock capability may be used for basic development or UI flows where appropriate, but it does not replace real native store testing.

Before release, test:

- successful purchase
- cancelled purchase
- failed purchase
- unavailable product
- offline/error state
- localized pricing
- iOS sandbox purchase
- Android test purchase
- repeated consumable purchases

---

# Future — Monthly Supporter

A recurring supporter option may be considered later.

Do not include it in the first Support release.

Possible future product:

```text
Aligner Tracker Supporter
$1.99/month
```

Because recurring subscriptions should provide ongoing value, any future supporter subscription should include a small nonessential ongoing benefit.

Possible benefits:

- supporter theme
- alternate supporter app icon
- small supporter acknowledgement

Core utility must remain free.

The following must **not** require supporter status:

- tracking
- corrections
- treatment-plan management
- notifications
- statistics
- treatment-plan history
- export of the user's own data

If subscriptions are introduced, add explicit support for:

- subscription state
- entitlement handling
- restore purchases
- manage subscription
- cancellation/expiration behavior

These concerns are intentionally deferred from V1.

---

# Restore Purchases

For V1 consumable tips:

- no restore workflow is required for historical tips
- no durable entitlement depends on them

If subscriptions or other durable entitlements are added later, the Support screen should then expose an appropriate **Restore Purchases** action.

Do not add restore UI solely for consumable V1 tips.

---

# Future Web Version

If Aligner Tracker later supports purchases on the web, prefer keeping RevenueCat as the common purchase/entitlement abstraction where practical.

Potential architecture:

```text
iOS
RevenueCat → App Store

Android
RevenueCat → Google Play

Web
RevenueCat Web → supported web billing provider
```

A web implementation may use Stripe or RevenueCat's supported web-billing approach underneath RevenueCat.

The exact web billing architecture should be evaluated when the web support feature is actually scheduled.

Do not introduce Stripe or web billing into the mobile implementation prematurely.

---

# Failure Isolation

Support purchases must remain isolated from core application behavior.

A purchase or RevenueCat failure must never prevent:

- opening the app
- loading the tracker
- writing IN/OUT punches
- changing trays
- viewing treatment information
- using notifications
- accessing local data

The Support feature should fail independently.

---

# Performance

Preserve the app's performance-first architecture.

The support feature should:

- initialize purchase infrastructure only when appropriate
- avoid unnecessary polling
- avoid loading purchase data on the critical tracker path
- avoid blocking app startup
- avoid adding unrelated dependencies
- avoid network requests from normal tracker actions

If practical, RevenueCat product data should be fetched when the user approaches or opens the Support feature rather than making monetization part of the app's critical startup path.

---

# Privacy and User-Centric Rules

Do not use support purchases as a reason to collect additional personal information.

Avoid:

- marketing profiling
- advertising identifiers
- purchase-based behavioral targeting
- sharing treatment data with monetization providers

Keep the purchase system logically separated from treatment and wear-history data.

Users should not need to provide treatment information to make a support purchase.

---

# Out of Scope for V1

Do not implement as part of the first Support feature:

- recurring subscriptions
- supporter entitlement system
- restore workflow for tips
- advertisements
- feature gating
- paywalls
- cloud-sync requirements
- Stripe in the mobile app
- web payments
- purchase analytics beyond what is operationally necessary
- promotional support prompts during normal tracker usage

---

# Priority

Support is a later feature.

Current core-functionality priority remains:

1. Punch corrections
2. Statistics
3. Treatment-plan history
4. Support Aligner Tracker
5. Cloud/account-related work later

Core tracker quality remains more important than monetization.
