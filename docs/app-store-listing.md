# App Store listing brief

Status: 1.0 Prepare for Submission
Target: iPhone, iOS 16.4+
Last updated: September 12, 2026

This document is the working source for the version 1.0 App Store listing. Keep
all copy and screenshots aligned with the production binary. Version 1.0 is a
free, local-first tracker; paid access, Cloud Backup, Apple Watch, and Siri /
App Shortcuts are deferred and must not be advertised.

## Listing copy

### App name

Aligner Tracker

### Subtitle

Track your aligner wear

This is within Apple's 30-character subtitle limit.

### Promotional text

Track aligner wear, tray changes, treatment history, and reminders without an account.

This is within Apple's 170-character promotional-text limit. Promotional text
can be changed without submitting a new app version.

### Description

Aligner Tracker is a simple, local-first companion for recording daily clear-aligner wear.

Track when your aligners are in or out, see today's wear time, manage tray changes, and keep your treatment history organized. The app is designed for quick daily use and does not require an account or an internet connection for core tracking.

Features include:

- Fast IN / OUT wear tracking
- Timestamp-based daily wear totals
- Current tray and treatment-day progress
- Tray changes and treatment-plan history
- Editing and correcting recorded IN / OUT times
- Statistics and graphs for reviewing progress
- Configurable local reminders
- Share Progress for sharing selected treatment information
- Help and Getting Started guidance

Your core treatment records are stored locally on your iPhone. Aligner Tracker does not diagnose conditions, prescribe treatment, or replace advice from your orthodontist or other clinician.

Use Aligner Tracker to record the treatment plan prescribed by your clinician and build a clear record of your daily wear.

### Keywords

aligners,wear time,retainer,orthodontic,braces,teeth,oral health,treatment

Keep the final keyword field at or below Apple's 100-character limit. Do not
repeat words already covered by the app name or subtitle unless testing shows a
clear discoverability reason.

### Suggested category

Primary: Medical
Secondary: Health & Fitness

Confirm the category against the actual audience and App Store Connect options
before submission.

## Screenshot strategy

Screenshots should show the product in use within the first two frames. They
should communicate the daily workflow without claiming clinical outcomes or
showing unfinished/deferred features.

Recommended sequence:

1. **Main tracker:** current tray, day, today's wear time, and the prominent IN / OUT action.
2. **Treatment progress:** tray progress and the change-tray workflow.
3. **History and corrections:** recorded IN / OUT times and editing controls.
4. **Statistics:** a useful graph or summary with a realistic sample history.
5. **Reminders:** notification settings and reminder controls.
6. **Share Progress or Help:** the sharing preview, or the Help / Getting Started screen.

Use the first three frames to explain the core value even if a viewer never
swipes further. Avoid screenshots of empty states, permission prompts, debug
content, TestFlight, account setup, paid features, cloud backup, Watch, or Siri.

## How to obtain the screenshots

1. Use the exact production candidate installed through TestFlight on a physical iPhone.
2. Create a clean but believable sample treatment dataset. Do not use personal health information or real names.
3. Set a consistent date/time context so totals, tray numbers, and graphs are coherent.
4. Capture the selected screens at the native device resolution using the iPhone screenshot shortcut.
5. Review every image for clipped text, accidental personal data, confusing values, and deferred feature references.
6. Add restrained captions only if they improve comprehension. Keep the app UI readable and let the screen itself carry the message.
7. Capture the largest required iPhone size first, then capture any additional required device sizes in the same state. Use App Store Connect's current media requirements for the exact dimensions and accepted formats.
8. Upload the frames to the App Store version in the intended order and verify the preview on both the product page and search results.

Do not manufacture screenshots from development builds or use the Expo starter
artwork. The submitted images should match the production build's appearance,
copy, colors, and enabled feature set.

## Capture checklist

- [ ] Production TestFlight build number recorded
- [ ] Sample data contains no personal information
- [ ] Main tracker is the first screenshot
- [ ] Text is readable at App Store thumbnail size
- [ ] No screenshot shows a disabled or deferred feature
- [ ] No medical promises, guaranteed results, or diagnostic claims
- [ ] Light/dark appearance choice is intentional and consistent
- [ ] Required iPhone sizes are captured from the current App Store Connect requirements
- [ ] Screenshots have been reviewed on-device and in the App Store preview

## Open listing decisions

- [ ] Confirm the final subtitle and keyword choices after reviewing App Store search terminology
- [ ] Confirm Medical as the primary category
- [ ] Confirm iPhone-only availability and do not enable iPad without testing the presentation
- [ ] Confirm public support URL and privacy policy URL
- [ ] Complete App Store privacy details from the shipping binary
- [ ] Complete age rating, copyright, export compliance, pricing, and territory settings
