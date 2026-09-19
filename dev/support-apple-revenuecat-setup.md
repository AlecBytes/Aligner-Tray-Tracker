# Support Aligner Tracker: Apple and RevenueCat Setup

Use this checklist to configure the three one-time consumable tips used by the iOS preview build. These tips grant no entitlement, unlock no features, and do not require an Aligner Tracker account.

## Fixed catalog contract

Do not substitute different identifiers. App Store Connect product IDs cannot be changed after creation, and the app rejects incomplete or mismatched catalogs.

| Tier | App Store product ID | RevenueCat package ID | Intended US price |
| --- | --- | --- | --- |
| Small Tip | `com.alecsbytes.alignertraytracker.tip.small` | `small_tip` | About $1.99 |
| Supporter Tip | `com.alecsbytes.alignertraytracker.tip.supporter` | `supporter_tip` | About $4.99 |
| Big Tip | `com.alecsbytes.alignertraytracker.tip.big` | `big_tip` | About $9.99 |

RevenueCat offering ID: `support`

Expected result: the `support` offering contains exactly these three custom packages, each linked to its corresponding Apple consumable. None is attached to an entitlement.

## 1. Confirm Apple prerequisites

- [ ] Sign in to [App Store Connect](https://appstoreconnect.apple.com/) with access to Agreements, Tax, and Banking and the Aligner Tracker app.
- [ ] Open **Business** and confirm the Paid Apps Agreement is active.
- [ ] Confirm required banking and tax information is complete and has no blocking action.
- [ ] Open **Apps → Aligner Tracker → App Information** and confirm bundle ID `com.alecsbytes.alignertraytracker`.
- [ ] Confirm the Apple developer account and EAS credentials use the intended production team.

Expected result: paid in-app purchases can be created for the same app record and bundle ID used by the preview build.

## 2. Create the Apple consumables

In **Apps → Aligner Tracker → Monetization → In-App Purchases**, create each product separately:

1. Click **Create** or **+**.
2. Select **Consumable**.
3. Enter the reference name and exact product ID below.
4. Save before configuring price and localization.

Create:

- [ ] Reference name `Small Tip`; product ID `com.alecsbytes.alignertraytracker.tip.small`.
- [ ] Reference name `Supporter Tip`; product ID `com.alecsbytes.alignertraytracker.tip.supporter`.
- [ ] Reference name `Big Tip`; product ID `com.alecsbytes.alignertraytracker.tip.big`.

For each product:

- [ ] Select a price point approximately equal to its intended US price.
- [ ] Add an English (U.S.) display name matching the tier name.
- [ ] Add a plain description such as “A one-time optional tip to support continued development of Aligner Tracker. No features are unlocked.”
- [ ] Add every localization required for the planned test or release territories.
- [ ] Add the App Review screenshot and review notes required by App Store Connect. Show the Support screen and explain that this is an optional repeatable consumable with no entitlement.
- [ ] Confirm the product is cleared for sale when Apple exposes that control.

Expected result: all three products have complete metadata and no missing-information warning. Apple may take time to propagate new products to sandbox systems.

## 3. Connect Apple to RevenueCat

- [ ] Sign in to [RevenueCat](https://app.revenuecat.com/) and open the existing Aligner Tracker project.
- [ ] Open **Project settings → Apps**.
- [ ] Create or open the Apple App Store app for bundle ID `com.alecsbytes.alignertraytracker`.
- [ ] Complete RevenueCat's App Store Connect integration fields and credentials using the least privilege RevenueCat documents.
- [ ] Verify the connection reports no credential, bundle-ID, or agreement error.

Never store an App Store Connect private key, issuer ID, shared secret, or RevenueCat secret API key in this repository or an `EXPO_PUBLIC_…` variable.

Expected result: RevenueCat can import products and validate sandbox transactions for the production bundle ID.

## 4. Import products into RevenueCat

In the RevenueCat Apple app's product catalog:

- [ ] Import `com.alecsbytes.alignertraytracker.tip.small`.
- [ ] Import `com.alecsbytes.alignertraytracker.tip.supporter`.
- [ ] Import `com.alecsbytes.alignertraytracker.tip.big`.
- [ ] Confirm all are recognized as non-subscription/consumable products.
- [ ] Confirm none is attached to `aligner_tray_tracker_pro` or any other entitlement.

Expected result: the three Apple products exist in RevenueCat without granting durable access.

## 5. Create the Support offering

In **Product catalog → Offerings**:

1. Create an offering with identifier `support`.
2. Do not reuse the paid-access `premium` offering.
3. Add three custom packages and attach one Apple product to each.

- [ ] Package `small_tip` contains `com.alecsbytes.alignertraytracker.tip.small`.
- [ ] Package `supporter_tip` contains `com.alecsbytes.alignertraytracker.tip.supporter`.
- [ ] Package `big_tip` contains `com.alecsbytes.alignertraytracker.tip.big`.
- [ ] The offering contains no additional package.
- [ ] None of the products is attached to an entitlement.

Expected result: RevenueCat offering `support` contains exactly the three packages in the fixed catalog contract.

## 6. Configure the EAS preview environment

Find the app-specific **public Apple SDK key** in RevenueCat. It begins with `appl_`. This public key may be included in an EAS client build; RevenueCat secret keys must never be included.

From the repository root, inspect the hosted preview environment:

```sh
eas whoami
eas env:list preview
```

In the Expo dashboard's preview environment, set or verify:

```text
APP_VARIANT=preview
EXPO_PUBLIC_APP_VARIANT=preview
EXPO_PUBLIC_SUPPORT_MODE=apple
EXPO_PUBLIC_PAID_ACCESS_MODE=apple
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_…
```

- [ ] The key begins with `appl_` and belongs to the RevenueCat Apple app for `com.alecsbytes.alignertraytracker`.
- [ ] No `test_` key is used in preview.
- [ ] No RevenueCat secret key is present.
- [ ] Hosted values agree with the preview profile in `eas.json`.

Expected result: Support fails closed if the public key is absent or has the wrong prefix; valid preview configuration exposes Support.

## 7. Build and install preview

RevenueCat is a native dependency. Use a fresh native build when the installed preview binary does not already contain the current `react-native-purchases` dependency or native configuration.

```sh
npm run validate
eas build --platform ios --profile preview
```

- [ ] Install the resulting internal-distribution build on a physical iPhone.
- [ ] Confirm its bundle ID is `com.alecsbytes.alignertraytracker`.
- [ ] Do not use Expo Go as evidence for Apple purchases.

Expected result: the preview app launches and shows **Support Aligner Tracker** in the Menu and the passive heart shortcut on the Tracker.

## 8. Prepare Apple sandbox testing

- [ ] Create or select an App Store Connect sandbox tester whose storefront covers the desired localized-price test.
- [ ] On the physical iPhone, use Apple's current sandbox-account sign-in flow.
- [ ] Do not use a production Apple account to make test purchases.
- [ ] Record the preview build number, iOS version, device model, tester storefront, and test date.

## 9. Verify the catalog and purchases

Open **Support Aligner Tracker** and record evidence for each item:

- [ ] All three tiers appear in Small, Supporter, Big order.
- [ ] Each price is the localized StoreKit price, not a hard-coded US value.
- [ ] Small Tip completes and shows the thank-you state.
- [ ] Supporter Tip completes and shows the thank-you state.
- [ ] Big Tip completes and shows the thank-you state.
- [ ] **Support again** returns to the product list.
- [ ] The same consumable can be purchased repeatedly.
- [ ] Cancelling returns without an error and says the user was not charged.
- [ ] A failed or interrupted transaction produces a retryable error.
- [ ] Airplane mode or store unavailability produces an isolated unavailable/error state.
- [ ] No purchase unlocks Premium Support or any other feature.
- [ ] There is no Restore Purchases control for tips.
- [ ] Tracker startup, IN/OUT, tray changes, themes, and local data continue working when RevenueCat or the network is unavailable.

## 10. Publish and verify an update

After validation and review:

```sh
git diff --stat
npm run validate
eas update --channel preview --message "Enable Apple sandbox Support tips" --environment preview --platform ios
```

On the installed preview build:

1. Connect to the internet.
2. Force close and reopen to download the update.
3. Force close and reopen again to apply it.
4. Repeat the catalog and one purchase test.

## Evidence record

Copy this block for each tested build:

```text
Date:
Tester:
Git commit:
EAS build/update ID:
App version/build:
Device/iOS:
Sandbox storefront:
Small Tip product/price/result:
Supporter Tip product/price/result:
Big Tip product/price/result:
Repeated purchase result:
Cancellation result:
Offline/failure result:
Core-tracker isolation result:
Notes/screenshots:
```

## Troubleshooting

### Support is hidden

- Confirm hosted `EXPO_PUBLIC_SUPPORT_MODE=apple`.
- Confirm `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` begins with `appl_`.
- Confirm the update was published with `--environment preview` and has been applied after two launches.
- Rebuild if the installed binary predates the RevenueCat native dependency.

### “Support options unavailable” appears

- Confirm offering ID is exactly `support`.
- Confirm package IDs and Apple product IDs exactly match the fixed catalog table.
- Confirm the offering has exactly three packages.
- Confirm the public key and bundle ID refer to the same RevenueCat Apple app.
- Check RevenueCat dashboard/API errors and App Store Connect agreement status.
- Allow time for newly created Apple products or metadata to propagate, then retry.

### Products exist but prices do not load

- Confirm the products have pricing, localization, and required metadata in App Store Connect.
- Confirm the sandbox tester's storefront is supported.
- Confirm paid-app agreements, tax, and banking are active.
- Confirm the physical device can reach Apple services.

### Purchase dialog or transaction fails

- Confirm the device uses a sandbox tester and the app has the production bundle ID.
- Confirm the installed build is the preview build, not Expo Go or the development bundle.
- Inspect RevenueCat customer/transaction logs without copying secrets into the repository.
- Test cancellation separately from store/network failure.

### A tip unlocks a feature

Remove the tip product from every RevenueCat entitlement immediately. Consumable Support tips must never be associated with `aligner_tray_tracker_pro` or application access logic.

## References

- [Apple: In-app purchase types](https://developer.apple.com/help/app-store-connect/reference/in-app-purchase-types/)
- [Apple: Create an in-app purchase](https://developer.apple.com/help/app-store-connect/manage-in-app-purchases/create-in-app-purchases/)
- [RevenueCat: Expo installation](https://www.revenuecat.com/docs/getting-started/installation/expo)
- [RevenueCat: Offerings](https://www.revenuecat.com/docs/offerings/overview)
- [RevenueCat: Non-subscription purchases](https://www.revenuecat.com/docs/platform-resources/non-subscriptions)
