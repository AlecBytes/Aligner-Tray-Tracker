# Cloud Backup & Restore

## Status

Phase 1 authentication foundation is implemented on iOS. Backup, restore, retention, storage, cloud-account deletion, and multi-device sync remain planned and are not implemented by Phase 1.

## Purpose

Provide optional disaster recovery and device-migration support without changing Aligner Tracker's local-first architecture.

SQLite remains the on-device source of truth. Core tracking must work without an account or network connection, and no tracker action may wait for a cloud request.

## Product Decisions

- Use Supabase for authentication, private snapshot storage, and backup metadata.
- Use Sign in with Apple as the account mechanism.
- An account is optional and cloud backup is not feature-gated.
- In the later backup phase, a successful sign-in will automatically enable backup; no second enable step will be required. Phase 1 only connects the Apple account and must not claim that a backup has run.
- Restore is allowed only when the installation has no local treatment data.
- The latest backup is the default restore choice, with an option to choose an older retained backup.
- Retain 7 daily snapshots, then 8 weekly snapshots, then one snapshot per month indefinitely while the cloud account exists.

## Phased Scope

### Phase 1: iOS authentication foundation

- Native Sign in with Apple through Supabase on iOS only
- securely persisted, installation-bound session and local-scope sign out
- **Cloud Backup** menu destination after local treatment setup
- explicit messaging that backup and restore are not available and no backup has run

The Phase 1 native Apple flow identifies the app with its iOS bundle identifier. It does not use a web OAuth redirect, so it needs neither an Apple Services ID nor a rotating OAuth client secret. Android and web OAuth are deferred. The Android and web **Account** destination remains informational and does not initialize Apple Authentication or Supabase.

### Later backup-and-restore phase

#### Included

- cloud-account deletion
- automatic backup after sign-in
- versioned logical snapshots of authoritative user data
- restore of the latest or a selected retained snapshot on an empty installation
- automatic tiered retention

#### Excluded

- live or multi-device sync
- merging cloud and local treatment data
- restore over existing local treatment data
- user-named backups or manual snapshot deletion
- per-record recovery
- sharing, collaboration, web access, or account-required core features

## Backup Behavior

1. After the later backup phase is available, a successful sign-in enables automatic backup and evaluates the local and remote state. Phase 1 sign-ins do not run this step.
2. If the installation is empty and the account has backups, do not upload anything; offer restore first.
3. If local treatment data exists, backup work may be scheduled only after the local operation has completed.
4. If both the installation and account are empty, wait until authoritative local treatment data exists before creating a backup.

Backup serialization, upload, retention, and failure handling must run outside normal tracker interactions. A failure must never roll back a local change, prevent another local action, or make the tracker depend on network availability. Exact scheduling, retry, and status-UI behavior remain implementation decisions.

### Snapshot Contents

Back up the authoritative user-created state needed to reconstruct the app, including treatment-plan versions, tray periods, wear punches, corrections, and any settings required to restore behavior. Do not back up derived statistics, cached read models, performance logs, or transient UI state.

The local `app_installation` record is device metadata used to bind secure sessions to the current install. It survives **Reset App** and must never be included in a backup.

Use a versioned logical snapshot rather than treating a live SQLite file as a remotely shared database. Each snapshot must carry enough metadata to validate and interpret it, including:

- snapshot/schema version
- creation time
- an integrity value such as a checksum

The precise payload format, compression policy, and metadata schema must be defined when implementation is scheduled.

## Restore Behavior

An installation is restore-eligible only when it has no local treatment plan, tray period, or wear-punch history. Local preferences alone do not block restore.

### Flow

1. The user signs in with Apple on an empty installation.
2. If backups exist, default to the latest snapshot and allow selection of an older retained snapshot.
3. Before applying a selected snapshot, verify its ownership, integrity, and schema compatibility away from live data.
4. Apply the restored data atomically so a failure cannot leave a partially restored installation.
5. Re-read operational state from SQLite only after validation and restoration succeed.

If download, validation, migration, or import fails, leave the existing local installation unchanged and offer retry. Restore never merges records and never silently deletes local treatment data.

If local treatment data exists, disable restore and explain that V1 restore is available only on a new or empty installation. Do not offer **Replace Local Data** in V1.

## Retention

Retention is automatic and based only on successful snapshots whose underlying payload changed.

- **Daily:** keep the newest snapshot in each of the 7 most recent daily buckets.
- **Weekly:** beyond the daily window, keep the newest snapshot in each of the next 8 weekly buckets.
- **Monthly:** beyond the weekly window, keep the newest snapshot for every calendar month indefinitely.

The exact calendar bucketing and pruning algorithm must be specified before implementation. Pruning must never remove the last known-good snapshot because an upload or prune failed.

Signing out does not delete backups. Deleting the cloud account permanently deletes its snapshots and backup metadata along with the cloud account.

## Supabase and Privacy Requirements

- Store snapshots in a private bucket with metadata scoped to the authenticated Apple-backed user.
- Enforce ownership with Supabase Row Level Security and server-side storage policies; never trust a client-supplied user ID.
- Use TLS in transit and Supabase-managed encryption at rest. Do not claim end-to-end encryption unless a later design actually implements client-held keys.
- Collect only identity, backup metadata, and payload data required by this feature.
- Keep service credentials out of the client. Privileged retention and deletion work must run in trusted server-side code.
- Account deletion must not report success unless the cloud account, backups, and backup metadata were deleted.

## Performance and Reliability

- Never perform authentication, serialization, hashing, upload, or retention work on the IN/OUT, tray-change, treatment-plan-save, startup-to-usable, or warm-resume critical path.
- Keep the mechanism that schedules cloud work outside the local transaction and UI critical path.
- Do not poll continuously or make one network request per source record.
- Measure snapshot creation and restore against the mature-treatment fixture described in `docs/performance.md` when implementation is scheduled.
- Do not add incremental backup or elaborate background infrastructure without a measured need.

## Acceptance Criteria

- Core tracking remains fully usable while signed out, offline, uploading, or after an upload failure.
- In the later backup phase, sign-in enables backup automatically without a second opt-in control; Phase 1 explicitly reports that no backup has run.
- An empty installation with existing remote backups is not uploaded before restore is offered.
- Local saves complete without waiting for Supabase.
- A user can restore the latest or another retained snapshot only on an empty installation.
- Failed restore leaves local data unchanged.
- Retention produces 7 daily, 8 weekly, and indefinite monthly recovery points when qualifying changed snapshots exist.
- One account cannot read, restore, or delete another account's backups.
- Deleting the cloud account deletes its cloud data; signing out does not.
