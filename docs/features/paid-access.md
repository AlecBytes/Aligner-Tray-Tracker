# Paid Access

## Confirmed commercial decision — 2026-09-05

Source: #38. This is the authoritative cross-feature purchase specification. Themes is the first paid feature; its visual behavior remains in `themes.md`. This document specifies planned behavior, not completed billing setup.

| Plan | US launch price | Access |
|---|---|---|
| Monthly | $0.99/month | All current and future paid features while subscribed |
| Annual | $7.99/year | All current and future paid features while subscribed |
| Lifetime | $49.99 once | Permanent access to all current and future paid features |

All plans provide the same feature scope. No free trials or introductory discounts at launch. Future paid features are included when released; do not imply that planned features already exist or promise delivery dates.

Core tracking, corrections, statistics, treatment plans/history, notifications, and access/export of personal data remain free. This decision does not reclassify existing free features or authorize implementation of future features. Consumable tips support development but grant no access and must never be attached to the paid entitlement.

## Purchase contract

- Use RevenueCat entitlement `premium` and explicit offering `premium`, replacing the earlier planned `themes` identifiers. This is an internal identifier, not a decision about marketing names.
- Map monthly and annual auto-renewable subscriptions and one lifetime non-consumable purchase to the same entitlement. Configure the subscriptions in one Apple subscription group at the same service level; lifetime is a separate non-consumable product.
- Include monthly, annual, and lifetime packages in the offering. Render localized prices and product-specific terms from store data; never hard-code currency, prices, or billing periods in UI logic. Annual shows the full yearly charge, not only a monthly equivalent; lifetime clearly says one-time payment with no renewal.
- Before integration, inspect existing dashboard configuration. If `themes` products/entitlements already have purchasers, preserve their access when mapping to `premium`; do not delete or detach purchased products blindly. No parallel themes-only entitlement is needed for a fresh setup.
- No app account required. Retain SDK-managed anonymous identity and account-free restore behavior from `themes.md`; optional cloud sign-in/sign-out must not alter purchase identity.
- Restore Purchases recovers both subscriptions and lifetime. An empty result says no eligible purchases were found, not no active subscription.
- Once lifetime access is confirmed, show its status and suppress redundant paid-access purchase buttons. If an existing subscriber buys lifetime, explain that their subscription must be cancelled separately and provide Manage Subscription; never imply the one-time purchase automatically cancels recurring billing.
- Keep Restore Purchases, Manage Subscription, Terms of Use, and Privacy Policy accessible. Core tracking never waits on billing.

## Access lifecycle

Use SDK-valid active entitlement information, never a locally invented paid flag. A successful transaction alone is insufficient.

Subscription cancellation keeps access until the paid period ends. Apply the known-expiration cutoff to subscription access, including offline, as specified in `themes.md`. Fresh service-confirmed grace may grant access; a network failure does not establish grace or renewal.

Confirmed active lifetime access has no scheduled expiry. Do not invent an expiry or let an expired subscription override valid lifetime access. A null expiry alone does not prove ownership. Keep SDK-valid cached lifetime access through transient failures; confirmed refund/revocation removes that grant, but another valid purchase may still grant access.

A fresh installation without usable cached access resolves asynchronously and can restore purchases using the same App Store account. Treatment backups never grant purchase access. Future paid feature specs must define safe access-loss behavior without deleting or trapping personal data.

## Release verification

#39 configures Test Store; #40 configures Apple products; #41 finalizes policies/disclosures; #42 verifies purchases; #43 verifies the release candidate. Their completion remains required under #37.

Verify all three purchase/restore paths, subscription renewal and expiry, lifetime without expiry, reinstall restoration, offline cached lifetime access, refunds/revocations, an expired subscription alongside valid lifetime, pending/cancelled/failed payments, and tips granting no access. Verify subscription management after a lifetime purchase by an existing subscriber. Identify simulations separately from real Apple sandbox evidence.

Policy URLs and actual store product identifiers remain setup inputs. This decision does not establish a permanent price guarantee or a future price-change policy.

## References

- [RevenueCat entitlements](https://www.revenuecat.com/docs/getting-started/entitlements)
- [Apple purchase types](https://developer.apple.com/help/app-store-connect/reference/in-app-purchases-and-subscriptions/in-app-purchase-types/)
