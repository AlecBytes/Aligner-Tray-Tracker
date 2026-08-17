# Donations / Support

## Decision

Use **RevenueCat** to handle in-app purchases for Aligner Tracker.

RevenueCat provides the lowest-friction path for supporting both iOS and Android while avoiding most of the StoreKit / Google Play Billing plumbing.

## Planned Support Options

Add a **Support Aligner Tracker** screen.

### One-time support

Offer a few fixed tip amounts, for example:

- $1.99 — Small Tip
- $4.99 — Supporter Tip
- $9.99 — Big Tip

These should be implemented as **consumable in-app purchases**.

### Recurring support

Optionally offer a small monthly supporter tier, for example:

- $1.99/month — Aligner Tracker Supporter

Because Apple expects auto-renewing subscriptions to provide ongoing value, the supporter tier should include a small nonessential benefit such as:

- Supporter app icon or theme
- Supporter badge / acknowledgement
- Other cosmetic perk

Core tracking functionality should remain available without supporting the app.

## Implementation

Use:

**Expo / React Native → RevenueCat → Apple StoreKit / Google Play Billing**

RevenueCat can manage:

- iOS and Android purchases
- One-time products
- Subscriptions
- Receipt validation
- Purchase restoration
- Subscription status
- Sandbox testing

Because RevenueCat requires native modules, purchase testing will require an **Expo development build** rather than Expo Go.

## Future Web Version

If Aligner Tracker later has a web version, use **Stripe** for web-based one-time or recurring support.

There is no need to introduce Stripe into the mobile app initially.

## Priority

This is a later monetization feature, not part of the current core-functionality work.

Current planned order remains:

1. Punch corrections
2. Statistics
3. Treatment-plan history
4. Support / donations and other later features
