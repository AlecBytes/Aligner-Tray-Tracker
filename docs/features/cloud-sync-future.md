# Cloud Sync (Future)

## Status

Future design track. Not part of Cloud Backup & Restore V1 and explicitly not ready for implementation.

No sync code, local outbox, sync metadata, server record tables, Realtime subscription, or migration should be added while Cloud Backup & Restore Phases 2D through 2G are incomplete. The next cloud implementation work is empty-installation restore, followed by automatic foreground backup, retention/orphan cleanup, and cloud-account deletion.

## Purpose

Define the constraints for eventual multi-device synchronization without prematurely turning backup snapshots into a sync system.

Cloud Backup & Restore provides recovery of a complete snapshot onto an empty installation. It does not merge concurrent device changes, propagate edits in real time, or establish a shared live database.

## Established Direction

- Preserve SQLite as each device's operational source of truth.
- Reuse Supabase and the same Sign in with Apple identity introduced for backup.
- Keep accounts optional for core tracking.
- Keep local writes immediate and available offline; network work must not block IN/OUT, tray changes, corrections, or plan edits.
- Sync authoritative source records, not derived statistics or cached views.
- Preserve timestamp-based wear history, append-only treatment-plan versions, tray-period boundaries, and existing local invariants.
- Prefer eventual consistency, a durable local outbox, idempotent server operations, and incremental cursors over full-snapshot exchange.
- Keep the initial sync design single-user and minimal. Do not introduce collaboration, sharing, microservices, or a second backend.

## Required Semantics Before Implementation

Record identity, mutation metadata, and deletion representation depend on the unresolved product semantics below. They must be designed before implementation rather than inferred from the current local schema.

The server may coordinate synchronization, but it must not become a network dependency for normal tracking. A device commits locally first, records an outbound operation durably, and syncs later. Incoming changes are validated and applied to SQLite transactionally before the UI reads the new state.

Treatment-plan history remains append-only. Sync must not rewrite an existing historical version. Wear-punch and tray-period changes must be validated as a coherent timeline rather than merged field by field when that could violate alternation or period boundaries.

Backup and sync must remain separate concepts:

- sync propagates current record-level changes between devices;
- backup creates immutable recovery snapshots;
- a sync error cannot prune or corrupt retained backups;
- restoring an old snapshot must not automatically publish stale state to other devices until a specific reconciliation policy exists.

Backup snapshots never contain future sync cursors, device registrations, outbox operations, tombstones, conflict records, or server mutation versions. Restoring a backup before sync exists restores only the authoritative local tracker state. If sync is later introduced, reconciliation of that restored state is a separate product decision and migration path.

## Product Decisions Still Required

Resolve and document these before scheduling implementation:

1. Whether V1 sync supports two active devices or an arbitrary number.
2. How to resolve concurrent wear-punch corrections and tray changes that cannot both satisfy timeline invariants.
3. Whether deletion is supported and, if so, how long tombstones are retained.
4. What happens when a user restores an older backup while other devices contain newer synced changes.
5. How device removal, account deletion, sign-out, and reauthentication affect queued operations.
6. Whether sync is automatically enabled for existing backup users or requires a distinct, informed opt-in.
7. What status, conflict, and recovery controls are understandable without adding routine workflow friction.

Do not leave these behaviors for an implementation agent to invent.

Record each decision in this document with:

- the user-visible rule;
- the local SQLite representation;
- the server representation;
- offline and retry behavior;
- conflict and idempotency behavior;
- sign-out, device-removal, restore, and account-deletion consequences; and
- acceptance examples covering two devices acting concurrently.

After those decisions are resolved, the first increment must remain single-user, use durable batched operations and incremental cursors, and retain Cloud Backup & Restore as an independent recovery path. Its exact device limit, supported records, recovery controls, and release behavior must come from the resolved product decisions rather than this document.

Real-time subscriptions, presence, shared treatment accounts, fine-grained history browsing, and web editing are excluded from the current direction.

## Performance and Reliability Guardrails

- No network request belongs on a core local write path.
- Startup and warm resume must become usable from SQLite without waiting for sync.
- Coalesce and batch operations; avoid one network request per punch.
- Do not continuously poll or wake the app solely to refresh derived values.
- Benchmark with the mature-treatment dataset in `docs/performance.md` and measure sync separately from the established local-action budgets.
- Add indexes, compaction, caching, or more elaborate conflict machinery only after profiling demonstrates a need and the unresolved semantics are settled.

## Entry Criteria

Cloud sync should not begin until:

- the local core and Cloud Backup & Restore are stable;
- the unresolved product decisions above are closed in this document;
- record identity, mutation, conflict, and deletion rules are specified;
- account/data-deletion behavior is specified and testable;
- performance budgets confirm that signed-in use does not regress local tracker responsiveness.

For clarity, “Cloud Backup & Restore are stable” means all of the following are true:

- empty-installation restore is released and corrupt or incompatible snapshots fail without changing local data;
- automatic foreground backup cannot upload over an empty installation that has remote recovery points;
- tiered retention and orphan cleanup have completed repeated scheduled runs without losing the protected newest recovery point;
- cloud-account deletion is idempotent, removes Auth, Storage, and metadata, and preserves local treatment data;
- cross-user database and Storage isolation tests pass; and
- mature-treatment measurements show no regression to local tracker critical paths.

Meeting these criteria permits sync product design and prototyping; it does not itself authorize production sync implementation. Production work begins only after all seven product decisions and the record/mutation/deletion model are approved here.

## Design Sequence After Entry Criteria

When the entry criteria are met, design sync in this order:

1. Close the seven product decisions with concrete concurrent-device examples.
2. Specify globally stable record IDs, device identity, mutation IDs, server ordering, deletion/tombstone rules, and cursor semantics.
3. Define invariant-preserving operations for plan versions, tray periods, and wear punches; do not use generic field-level last-write-wins for timelines.
4. Define restore reconciliation before any restored installation can connect to sync.
5. Define local outbox transaction boundaries, batching, retry, compaction, and sign-out/account-deletion handling.
6. Define the minimal RLS-protected server schema and idempotent batch API.
7. Build a narrow two-device simulator and conflict test suite before integrating with tracker UI.
8. Implement the smallest approved single-user device count and record scope behind a release control.

This design sequence may produce a separate implementation plan later. It must not modify the existing snapshot format or backup retention path merely to simplify sync.
