# Treatment Plan History

## Status

Planned feature after **Statistics**.

## Existing Data Model

Treatment plan edits already create append-only `TreatmentPlanVersion` records.

The current UI shows only the latest active treatment plan.

## Direction

This future feature will expose historical treatment-plan versions to the user.

The detailed product specification has **not yet been finalized**.

Before implementation, define:

- list/order of historical versions
- fields displayed for each version
- effective-date presentation
- whether comparison between versions is needed
- whether historical versions are read-only
- how plan versions relate visually to tray history

Do not modify or overwrite historical plan versions.
