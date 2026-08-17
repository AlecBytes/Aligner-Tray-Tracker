# Codex Prompt — Notification Settings

Inspect the current repo first.

Read:

- `AGENTS.md`
- `docs/mvp-plan.md`
- `docs/features/notification-settings.md`

Implement **Notification Settings** according to the feature spec.

Where the feature spec conflicts with the older MVP notification assumptions, the feature spec takes precedence.

Preserve existing tracker, tray-change, treatment-plan, and local-notification behavior. Reuse the existing notification service and SQLite/repository patterns rather than creating parallel infrastructure.

Keep the feature local-only and lightweight. Do not add cloud, authentication, push notifications, statistics, or unrelated features.

Add focused tests for persistence and notification reconciliation, run the existing validation checks, and stop when the feature is complete.

Summarize:

- files/schema changes
- settings UI
- scheduling/rescheduling behavior
- permission handling
- tests/check results
- any remaining native-device tests or edge cases
