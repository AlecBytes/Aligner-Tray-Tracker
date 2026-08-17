# Treatment Plan History V1

## Status

Treatment Plan History V1 is the source of truth for the first user-facing treatment-plan history feature.

## Goal

Let a user review every saved version of the configured treatment plan without changing historical data.

## Access and Navigation

- Add a `View Plan History` action to the existing Treatment Plan screen.
- Open history as a separate stack screen titled `Plan History`.
- Do not add Treatment Plan History to the main menu.

## History List

- Show every `TreatmentPlanVersion` for the configured treatment.
- Order versions newest first using `effective_at DESC, id DESC`.
- Use the record id as the deterministic tie-breaker when effective timestamps match.
- The first record in that ordering is the current version and is labeled `Current`.
- Each version displays:
  - its effective local date and time, using the device locale
  - total trays
  - days per tray
  - prescribed hours per day
- Convert the stored prescribed-minute value to a compact hours/minutes value:
  - `1320` minutes displays as `22h`
  - `1350` minutes displays as `22h 30m`
  - values below one hour display as minutes, such as `30m`
- Keep each version in a compact card consistent with the existing minimal UI.

## Read-Only Behavior

- History has no edit, delete, restore, comparison, or rollback actions.
- Saving the existing Treatment Plan form continues to insert a new append-only `TreatmentPlanVersion`.
- A later edit must not update or remove any earlier version.
- The history screen reads through a repository/read-model boundary. React components must not contain raw SQLite queries or row mapping.
- Normal history viewing remains local-first and requires no network access.

## Loading, Empty, and Error States

- Show a loading state while versions are being read.
- If no versions exist, explain that no treatment-plan history was found.
- If history cannot be loaded, show a clear error and a retry action.
- A configured treatment should normally have at least one version, but the UI must handle an empty result safely.

## V1 Verification

Focused tests cover:

- versions are returned newest first
- the newest version is identified as current
- multiple saved edits remain visible
- later edits leave historical values unchanged
- prescribed minutes format correctly as hours/minutes
- same-day versions use the full effective timestamp and id for deterministic ordering

## Out of Scope

- plan rollback, restore, or deletion
- version comparison UI
- statistics changes
- CSV export
- authentication
- cloud sync
- backend work
- tray-history visualization or other unrelated features
