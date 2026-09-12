# App Store website specification

Status: Required before version 1.0 submission
Target: Aligner Tracker for iPhone, iOS 16.4+
Last updated: September 12, 2026

This is the minimum public website specification for App Store Connect. It is
intentionally small: version 1.0 needs a working support page and privacy policy,
not a full marketing site.

## Public pages

Publish these pages on a stable HTTPS domain with no sign-in, paywall, cookie
wall, or app-only dependency:

- `/support/` — support information for users and App Review
- `/privacy/` — the privacy policy for the shipped production binary

Use the same domain for both pages. The URLs must remain stable after release.
If a page moves, keep a redirect at the old URL.

The App Store listing fields should use:

- Support URL: the public `/support/` page
- Privacy Policy URL: the public `/privacy/` page
- Marketing URL: optional for version 1.0; leave blank until a real marketing page exists

## Shared page requirements

Both pages must:

- Load over HTTPS on a phone and desktop browser.
- Be readable without JavaScript and usable with a narrow viewport.
- Display the product name, `Aligner Tracker`.
- Link to the other page.
- Provide a visible support email link to `support@alecbytes.com`.
- Show a last-updated date.
- Avoid App Store Connect, TestFlight, development, or placeholder language.
- Avoid claims that the app diagnoses conditions, guarantees results, or replaces a clinician.
- Avoid advertising, tracking pixels, analytics, or third-party embeds in the minimum site.

## Support page requirements

The support page should answer the basic questions a user or reviewer may have
without requiring an account.

### Required content

1. **What the app does**

   Describe Aligner Tracker as a local-first tool for recording prescribed
   clear-aligner wear, tray changes, treatment history, statistics, and local
   reminders.

2. **How reminders work**

   Explain that users can configure on-device reminders when trays have been
   out too long and reminders for scheduled tray changes. Explain that reminders
   depend on iPhone notification permissions and device settings.

3. **Offline/account behavior**

   State that core tracking does not require an account or internet connection.
   Do not advertise Cloud Backup, paid access, Apple Watch, Siri, or App
   Shortcuts in the version 1.0 support page because those features are disabled
   or deferred in production.

4. **Basic troubleshooting**

   Include concise guidance for:

   - Notifications: check iPhone notification permission and the app's reminder settings.
   - Missing or unexpected times: review the recorded IN/OUT history and use the app's correction tools.
   - A new phone or reinstall: explain that local records are stored on the device and that version 1.0 does not provide production cloud restore.
   - Reset: explain that Reset App removes local treatment data only after confirmation; it is not account deletion or subscription cancellation.

5. **Contact**

   Provide a mail link to `support@alecbytes.com` and state what to include in a
   useful report: iPhone model, iOS version, app version/build, steps to
   reproduce, and whether notifications were enabled. Tell users not to send
   sensitive health information.

6. **Clinical limitation**

   State that the app records user-entered treatment information and does not
   provide medical advice. Treatment changes should come from the user's
   orthodontist or other clinician.

## Privacy policy requirements

The privacy page must describe the actual version 1.0 production binary, not
future cloud or paid-access plans. Have the rights holder review the final text
before publishing; this document defines product requirements, not legal advice.

### Required disclosures

The policy should clearly cover:

- **Treatment and usage data:** treatment setup, tray information, timestamps,
  corrections, history, statistics, and reminder settings are stored locally in
  the app's on-device SQLite database.
- **Notifications:** local notifications are scheduled on the user's iPhone;
  reminder content is not sent to a remote notification service by the core app.
- **Sharing:** Share Progress is user initiated. Explain that information is
  sent only to the destination the user selects through the iOS share sheet.
- **Accounts:** version 1.0 core tracking does not require an account or sign-in.
- **Network and cloud:** Cloud Backup is disabled in the version 1.0 production
  build. Do not imply that treatment records are backed up remotely.
- **Advertising and analytics:** state the actual use or non-use of these
  services after checking the shipping binary and its dependencies. Do not make
  a blanket "we collect nothing" claim without verifying SDK behavior.
- **Support email:** messages sent to `support@alecbytes.com` are received by
  the support mailbox and may contain whatever the user chooses to include.
  Request that users omit sensitive health information.
- **Deletion and retention:** explain how a user can delete local app data using
  Reset App and how support emails are handled under the publisher's retention
  practice. Clarify that deleting local data does not delete an email already
  sent to support.
- **Children:** state the intended audience and any age-related handling that
  matches the App Store age-rating decision.
- **Changes and contact:** provide an effective/updated date and the support
  contact for privacy questions.

The privacy page must match the App Store privacy questionnaire. Review the
final policy against the archive, privacy manifests, required-reason APIs, and
enabled dependencies before submission.

## Minimum visual and technical bar

A simple static HTML site is sufficient. It does not need accounts, a CMS,
search, a blog, a contact form, an app download flow, or a marketing animation.

Use:

- A clear page title and heading.
- High-contrast text and links.
- Visible keyboard focus states.
- Semantic headings and lists.
- A responsive layout that works at phone width.
- No collection of visitor data beyond ordinary hosting logs.

## Deployment options

Choose one stable public host:

1. **GitHub Pages:** suitable for these static pages if the repository's Pages
   site is enabled and the resulting URLs are tested publicly.
2. **Existing publisher domain:** preferred if `alecbytes.com` already has a
   stable hosting setup.
3. **Another static host:** acceptable if it provides HTTPS, durable URLs, and
   no access restriction.

Do not enter example URLs in App Store Connect. Verify the final URLs from a
private browser window and on an iPhone before submission.

## Acceptance checklist

- [ ] `/support/` returns a public HTTPS page.
- [ ] `/privacy/` returns a public HTTPS page.
- [ ] Both pages work without JavaScript, login, or a special app.
- [ ] Support email opens the correct mailbox.
- [ ] Support and privacy pages link to each other.
- [ ] Version 1.0 does not advertise disabled or deferred features.
- [ ] Reminder behavior and offline/local storage descriptions match the build.
- [ ] Privacy wording matches the App Store privacy answers and shipping dependencies.
- [ ] Pages are readable on an iPhone and a desktop browser.
- [ ] Final URLs are entered in App Store Connect and recorded in the release evidence.
