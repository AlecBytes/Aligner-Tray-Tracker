# Cloud Backup & Restore

## Status

Phase 1 authentication is implemented on iOS. Phase 2A provides private snapshot Storage and metadata, Phase 2B provides deterministic native-mobile snapshot serialization, Phase 2C provides an iOS **Back Up Now** flow, and Phase 2D provides empty-installation restore on iOS.

Phase 2D still requires local Supabase policy-test execution and release-like iPhone verification before release. The next implementation increment is Phase 2E automatic foreground backup, followed by Phase 2F retention and orphan cleanup and Phase 2G cloud-account deletion. Multi-device sync is a separate future feature and is not part of these phases.

## Purpose

Provide optional disaster recovery and device-migration support without changing Aligner Tracker's local-first architecture.

SQLite remains the on-device source of truth. Core tracking must work without an account or network connection, and no tracker action may wait for a cloud request.

## Product Decisions

- Use Supabase for authentication, private snapshot storage, and backup metadata.
- Use Sign in with Apple as the account mechanism.
- An account is optional and cloud backup is not feature-gated.
- In Phase 2E, a successful sign-in automatically enables foreground backup; no second enable step is required. Phase 1 only connected the Apple account and did not claim that a backup had run.
- Restore is allowed only when the installation has no local treatment data.
- The latest backup is the default restore choice, with an option to choose an older retained backup.
- Retain 7 daily snapshots, then 8 weekly snapshots, then one snapshot per month indefinitely while the cloud account exists.
- Empty-installation restore must be reachable from treatment setup; it cannot live only behind the treatment-present route gate.
- Restore V1 accepts snapshot schema version 1 only. A newer unsupported version is shown as incompatible and is never partially imported.
- Automatic backup uses foreground, best-effort work. The first implementation does not add an OS background task, continuous polling, or a required network step to any local write.
- Retention buckets use UTC calendar boundaries so the same recovery points are selected regardless of the device or server time zone.
- Signing out is local and preserves cloud data. Cloud-account deletion is a separate destructive server operation and preserves local treatment data.

## Phased Scope

### Phase 1: iOS authentication foundation

- Native Sign in with Apple through Supabase on iOS only
- securely persisted, installation-bound session and local-scope sign out
- **Cloud Backup** menu destination after local treatment setup
- explicit messaging that backup and restore are not available and no backup has run

The Phase 1 native Apple flow identifies the app with its iOS bundle identifier. It does not use a web OAuth redirect, so it needs neither an Apple Services ID nor a rotating OAuth client secret. Android and web OAuth are deferred. The Android and web **Account** destination remains informational and does not initialize Apple Authentication or Supabase.

### Phase 2C: manual iOS backup

- The signed-in iOS Cloud Backup screen provides **Back Up Now**, progress, the last completed server timestamp, and retryable failure feedback.
- A backup revalidates the Supabase user, serializes SQLite atomically, skips an unchanged completed content hash, uploads a new immutable JSON object, and then inserts metadata.
- Metadata insertion is the completion marker. An object whose metadata insert failed remains private and incomplete, is not shown as a recovery point, and is never treated as success.
- Ordinary navigation does not cancel an in-flight backup. The operation may finish without updating the departed screen, and completed metadata is reloaded when the screen returns.

Phase 2C does not automatically run after sign-in or local changes. It adds no durable background retry, cleanup, retention, restore, or client overwrite/delete access.

### Phase 2D: empty-installation restore

- The iOS treatment-setup screen provides **Restore from Cloud Backup** outside the treatment-present route gate.
- Restore reuses Sign in with Apple and the installation-bound Supabase session.
- The recovery screen lists the authenticated user's completed recovery points with stable keyset pagination, selects the latest supported point by default, and allows an older point to be selected.
- A selected snapshot is privately downloaded, canonicalized, hashed, and semantically validated before any live SQLite mutation.
- Restore rechecks local eligibility and imports the snapshot with preserved IDs in one exclusive SQLite transaction.
- Local notifications are reconciled after commit before routing into the restored tracker; scheduling failure is reported without rolling back treatment data.

### Phase 2E: automatic foreground backup

- After sign-in, evaluate local and remote state before deciding whether to upload.
- Request coalesced backup work after authoritative local writes complete and again on a later foreground/resume opportunity.
- Reuse the Phase 2C serializer, hash deduplication, immutable upload, and metadata completion marker.
- Keep **Back Up Now** as an explicit status and retry control.
- Do not add an OS background task or durable server work queue in this phase.

### Phase 2F: retention and orphan cleanup

- Run automatic tiered retention in trusted server-side code on a daily schedule.
- Remove incomplete Storage objects that have no completed metadata after a 24-hour grace period.
- Keep client update and delete permissions disabled.
- Make pruning and cleanup idempotent and safe to retry.

### Phase 2G: cloud-account deletion

- Provide an in-app destructive confirmation while signed in.
- Invoke authenticated trusted server-side code that removes all owned backup objects, metadata, and the Supabase Auth user.
- Clear the local cloud session only after the server confirms completion.
- Preserve all local treatment data and local preferences.

### Excluded from Phases 2D through 2G

- live or multi-device sync
- merging cloud and local treatment data
- restore over existing local treatment data
- user-named backups or manual snapshot deletion
- per-record recovery
- sharing, collaboration, web access, or account-required core features

## Backup Behavior

The Phase 2C manual flow is:

1. Revalidate the current user with Supabase Auth and derive the storage namespace only from that verified user.
2. Produce the canonical V1 snapshot and SHA-256 metadata from one isolated SQLite read transaction.
3. Query completed metadata for the same content hash. If it exists, report that backup is current without uploading.
4. Generate a client snapshot UUID and upload compact JSON to `<user UUID>/<snapshot UUID>.json` with overwrite disabled.
5. Insert the matching metadata and use its server-controlled `created_at` as the last successful backup time.
6. If a concurrent metadata insert wins the unique user/hash race, re-read it and report the existing recovery point as current.

Storage success without metadata success is incomplete. The client has no update or delete policy, so it leaves that private orphan for a future trusted cleanup phase and retries with a new UUID.

### Automatic backup coordinator

Phase 2E adds one app-scoped, single-flight coordinator. It is requested:

- immediately after a successful sign-in;
- after an authoritative local write has completed and the local UI is free to update;
- when a signed-in app next becomes active; and
- when the user chooses **Back Up Now**.

Requests are coalesced while work is pending or running. A foreground request may use a short in-process debounce to combine related local changes, but no local save waits for that debounce, serialization, or network work.

Every automatic run performs this state evaluation before uploading:

1. Revalidate the current Supabase user.
2. Check restore eligibility from SQLite and check whether completed remote metadata exists.
3. If the installation is empty and remote backups exist, publish a local **restore available** state and do not serialize or upload.
4. If local treatment data exists, run the existing snapshot pipeline. Hash deduplication makes an unchanged state a successful no-op.
5. If both sides are empty, do nothing until authoritative local treatment data exists.

Automatic failure is best effort. It is shown on the Cloud Backup screen and retried by **Back Up Now**, the next foreground/resume opportunity, or the next completed authoritative local write. Phase 2E does not persist a retry queue and does not register an OS background task. An in-flight foreground backup may finish after navigation, as in Phase 2C.

Backup serialization, upload, retention, and failure handling run outside normal tracker interactions. A failure never rolls back a local change, prevents another local action, or makes the tracker depend on network availability.

### Snapshot Contents

Back up the authoritative user-created state needed to reconstruct the app, including treatment-plan versions, tray periods, wear punches, corrections, and any settings required to restore behavior. Do not back up derived statistics, cached read models, performance logs, or transient UI state.

The local `app_installation` record is device metadata used to bind secure sessions to the current install. It survives **Reset App** and must never be included in a backup.

Use a versioned logical snapshot rather than treating a live SQLite file as a remotely shared database. Each snapshot must carry enough metadata to validate and interpret it, including:

- snapshot/schema version
- server-controlled creation time in the backup metadata record
- an integrity value such as a checksum

#### Snapshot format V1

The compact JSON envelope is:

```text
{
  schemaVersion: 1,
  sourceAppVersion: string,
  payload: SnapshotPayloadV1
}
```

`SnapshotPayloadV1` uses camel-case property names and includes only these SQLite fields:

- `treatments`: `id`, `created_at`
- `treatment_plan_versions`: `id`, `treatment_id`, `total_trays`, `days_per_tray`, `daily_wear_goal_minutes`, `effective_at`, `created_at`
- `tray_periods`: `id`, `treatment_id`, `tray_number`, `started_at`, `ended_at`
- `wear_punches`: `id`, `tray_period_id`, `status`, `timestamp`
- `settings`: `out_reminder_enabled`, `out_reminder_minutes`, `out_persistent_reminder_interval_minutes`, `tray_change_reminder_enabled`, `tray_change_reminder_hour`, `tray_change_reminder_minute`, represented by the singleton `notificationSettings` object without its fixed row ID

Punch corrections have no separate audit table. The final corrected, added, or remaining `wear_punches` rows are the authoritative state included in the snapshot.

Records are canonicalized in ascending order by stable semantic keys: treatments by ID; plan versions by treatment, effective time, and ID; tray periods by treatment, start time, and ID; and punches by tray period, timestamp, and ID. Object properties also use a fixed order, so the same state produces byte-identical JSON when the source app version is unchanged.

The lowercase hexadecimal SHA-256 `content_hash` covers compact JSON containing only `{ schemaVersion, payload }`. It excludes `sourceAppVersion` and does not include a snapshot ID or creation time, so those volatile values do not make unchanged local state appear new. `payload_bytes` is the UTF-8 byte length of the complete envelope JSON. Phase 2A metadata receives the serializer's `schemaVersion`, `sourceAppVersion`, `contentHash`, and `payloadBytes` as `schema_version`, `app_version`, `content_hash`, and `payload_bytes` respectively.

Serialization is supported on native iOS and Android and uses one isolated Expo SQLite read transaction. Web backup serialization is deferred because the required exclusive transaction API is not supported by Expo SQLite 57 on web.

V1 explicitly excludes the device-bound `app_installation` row, the obsolete `settings.notifications_enabled` column, SQLite schema metadata, derived statistics and cached read models, scheduled-notification identifiers and delivery state, UI/navigation state, performance logs, authentication or SecureStore data, Supabase identifiers or credentials, and non-persisted support-purchase state. V1 uses uncompressed complete snapshots; compression and incremental formats are not part of this phase.

## Restore Behavior

An installation is restore-eligible only when `treatments`, `treatment_plan_versions`, `tray_periods`, and `wear_punches` are all empty. The eligibility check ignores the singleton `settings` row and `app_installation`; local preferences and installation identity alone do not block restore.

Eligibility is checked when the screen loads and checked again inside the import transaction. If any treatment data appears between those checks, the restore stops without changing SQLite. V1 never merges and never offers to replace local treatment data.

### Entry and recovery-point discovery

- The iOS treatment-setup screen provides **Restore from Cloud Backup** without requiring treatment creation first.
- The restore route lives outside the treatment-present route group. A direct visit to the normal Cloud Backup menu may still require an existing treatment.
- The restore screen supports Apple sign-in, signed-out, loading, offline, retry, no-backups, and recovery-points-found states.
- Only completed `backup_snapshots` metadata visible through the authenticated user's RLS policy is listed.
- Results are ordered by `created_at DESC, id DESC`. The latest is selected by default.
- Fetch recovery points in pages of 25 using `(created_at, id)` keyset pagination. Do not use unbounded reads or offset pagination because monthly backups are retained indefinitely.
- Each row shows the server creation time and source app version. Snapshot IDs, hashes, byte counts, and Storage paths are implementation details and are not presented as user choices.
- A metadata row with a schema version newer than the app supports remains visible but disabled with an **Update Aligner Tracker to restore this backup** explanation.

The metadata query must remain covered by an index beginning with `user_id, created_at DESC`; add `id DESC` to the recovery-list index when implementing keyset pagination.

### Flow

1. The user signs in with Apple on an empty installation.
2. If backups exist, default to the latest snapshot and allow selection of an older retained snapshot.
3. Revalidate the current user immediately before download.
4. Download the selected object from the private bucket with the authenticated Supabase client. Do not create a public or signed URL.
5. Verify the downloaded bytes and snapshot completely in memory before opening a SQLite write transaction.
6. Recheck restore eligibility and import the snapshot in one exclusive SQLite transaction.
7. Re-read operational state from SQLite only after the transaction commits.
8. Reconcile local notifications from restored settings and route to the tracker.

### Download and validation

Before import, the client must verify all of the following:

- the selected metadata row was returned through the authenticated user's RLS-scoped query;
- `storage_path` is exactly `<verified user UUID>/<metadata snapshot UUID>.json`;
- `schema_version` is supported and matches the envelope `schemaVersion`;
- `app_version` is nonblank and matches `sourceAppVersion`;
- `payload_bytes` is positive, does not exceed the bucket's 50 MiB limit, and equals the downloaded UTF-8 byte length;
- the JSON envelope contains exactly the V1 keys and field types;
- canonical compact JSON containing only `{ schemaVersion, payload }` hashes to the metadata `content_hash`; and
- canonical collection ordering and fixed object-property ordering match Snapshot V1.

The V1 semantic validator must also reject data the current local application could not safely operate:

- zero or more than one treatment;
- a treatment without at least one plan version, tray period, or wear punch;
- duplicate IDs or missing parent records;
- nonpositive IDs, invalid settings, invalid plan ranges, invalid tray numbers, or unsafe-integer timestamps;
- overlapping tray periods or more than one active tray period;
- an active tray period that is not the latest period;
- a tray period without its anchor punch;
- punches outside their tray period, non-increasing punch timestamps within a period, or non-alternating statuses within a period; and
- any condition that would make `getTrackerSnapshot` fail immediately after import.

Validation is pure and does not create staging rows in the live database. Unknown envelope properties, unsupported schema versions, and noncanonical data fail closed.

### Atomic import

The exclusive SQLite transaction performs only local validation and writes; it makes no network request. It:

1. rechecks that all four treatment tables are empty;
2. inserts the treatment while preserving its snapshot ID;
3. inserts plan versions, tray periods, and wear punches in foreign-key order while preserving IDs;
4. updates the existing singleton settings row with the restored notification settings;
5. leaves `app_installation`, the obsolete `settings.notifications_enabled` column, SecureStore, and the Supabase session untouched; and
6. queries the restored tracker state before committing so an unusable import rolls back.

Explicitly preserved integer primary keys allow restored foreign keys to remain unchanged. Later SQLite inserts continue from IDs greater than the restored maxima.

Notification scheduling is derived external state and cannot participate in the SQLite transaction. If post-commit notification reconciliation fails, treatment restoration remains successful, the tracker opens, and the app reports that reminders need attention. Normal notification initialization or a later foreground reconciliation retries it.

If download, validation, migration, or import fails, leave the existing local installation unchanged and offer retry. Restore never merges records and never silently deletes local treatment data.

If local treatment data exists, disable restore and explain that V1 restore is available only on a new or empty installation. Do not offer **Replace Local Data** in V1.

## Retention

Retention is automatic and based only on successful snapshots whose underlying payload changed.

- **Daily:** keep the newest snapshot in each of the current UTC date and previous 6 UTC dates.
- **Weekly:** for snapshots older than the daily window, keep the newest snapshot in each of 8 consecutive ISO weeks. The first weekly bucket is the ISO week containing the UTC date immediately before the daily window; weeks start Monday at 00:00 UTC.
- **Monthly:** for snapshots older than the start of the eighth weekly bucket, keep the newest snapshot in each UTC calendar month indefinitely.

At a retention run time `T`:

1. Truncate `T` to UTC midnight and construct the 7 daily bucket keys.
2. Construct the 8 ISO-week bucket keys immediately preceding the daily tier as defined above.
3. Assign every completed metadata row to the first applicable tier: daily, then weekly, then monthly.
4. Within a bucket, keep the row with the greatest `(created_at, id)` and mark the others as prune candidates.
5. Protect the greatest `(created_at, id)` for the user unconditionally, even if a bucketing bug or partial dataset would otherwise mark it.

Missing calendar buckets stay empty; they are not replaced by older populated buckets. This prevents a long-inactive account from retaining many old weekly snapshots in addition to its monthly recovery points.

Retention runs once daily in trusted server-side code. It queries candidates with privileged metadata access, but deletes Storage objects only through the Supabase Storage API. The client receives no metadata-delete or Storage-delete policy.

For each prune candidate, trusted code removes the completed metadata row first and then removes the Storage object. A failure after metadata deletion can leave a private orphan, but cannot leave a visible recovery point whose object was intentionally removed. Orphan cleanup safely retries object removal later. A failed metadata deletion leaves the completed recovery point untouched.

Pruning never removes the unconditionally protected newest recovery point. An upload does not invoke pruning inline; only a completed metadata insert may be considered by a later scheduled retention run.

### Orphan cleanup

An object in `backup-snapshots` is orphaned when its exact bucket/path has no matching completed `backup_snapshots` row. Trusted cleanup may delete an orphan only when its Storage `created_at` is at least 24 hours old. This grace period protects an upload whose metadata commit is still being retried.

Cleanup lists objects with cursor-based or provider-supported pagination, handles Storage API batch limits, and is idempotent. It never derives ownership from client input and never deletes by an unvalidated broad prefix.

Signing out does not delete backups. Deleting the cloud account permanently deletes its snapshots and backup metadata along with the cloud account.

## Cloud-Account Deletion

Cloud-account deletion is an authenticated, destructive, server-side operation. It is distinct from local sign out and **Reset App**.

### Client flow

1. Show a destructive confirmation explaining that cloud recovery points and the Apple-backed cloud account will be permanently deleted while local tracker data remains.
2. Revalidate the current Supabase user and invoke the deletion endpoint with the current user session.
3. Disable duplicate submissions while the request is in progress.
4. On confirmed server success, clear the installation-bound local session and show the signed-out state.
5. On failure, do not claim deletion. Explain that some cleanup may already have occurred and offer an idempotent retry.

### Trusted server flow

The endpoint must authenticate the caller, derive the target user UUID only from the verified session, and reject anonymous or mismatched input. It must never accept an arbitrary deletion target from the request body.

It then:

1. lists every object under the exact `<verified user UUID>/` namespace, including objects without completed metadata;
2. removes all listed objects through the Storage API, respecting pagination and batch limits;
3. verifies that the namespace is empty;
4. permanently deletes the Supabase Auth user with the server-only admin API; and
5. relies on the `backup_snapshots.user_id` foreign key cascade to remove remaining metadata, then verifies that no user metadata remains.

Supabase does not allow deletion of an Auth user who still owns Storage objects, so object cleanup precedes Auth deletion. Refresh sessions are revoked when the Auth user is deleted. Because already-issued access tokens can remain valid until expiry, sensitive deletion and cleanup operations validate the JWT `session_id` against the active session, and the project keeps access-token expiry short. Storage and metadata policies must be reviewed so a deleted session cannot recreate durable cloud data during that expiry window.

The operation is idempotent: missing objects and already-removed metadata are success states during retry. It returns success only after the Auth user, Storage objects, and metadata are all absent.

### Trusted access

The current metadata migration revokes all `service_role` table privileges. Before Phases 2F and 2G, add a reviewed migration granting only the metadata operations required by trusted retention and deletion code, normally `SELECT` and `DELETE`, to the server-only role used by those functions. Keep `anon` without access and keep authenticated clients limited to their existing owned `SELECT` and constrained `INSERT` paths.

Any privileged database helper belongs in a non-exposed schema, uses a fixed empty `search_path` with schema-qualified names, has execution revoked from `PUBLIC`, `anon`, and ordinary `authenticated` clients, and performs an explicit caller/session check when user-invoked. Run database security advisors and policy tests after the change.

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

Recovery-point metadata uses one query per page and a snapshot uses one Storage download. Restore never fetches source records individually. Keep SQLite import transactions short by parsing, hashing, and semantic validation before the transaction begins.

All app-owned visible iOS restore, status, confirmation, and error UI uses `@expo/ui/swift-ui` under the existing iOS UI purity rule.

## Implementation Order and Verification

Verify, implement, and release the remaining work in this order:

1. **Phase 2D release verification:** run local database policy tests and advisors, then complete release-like iPhone restore and mature-treatment measurements.
2. **Phase 2E automatic foreground backup:** state evaluator, coordinator triggers, coalescing, status, and retry behavior.
3. **Phase 2F retention and orphan cleanup:** trusted access migration, pure bucket-selection tests, scheduled cleanup, idempotency, and operational visibility.
4. **Phase 2G cloud-account deletion:** authenticated endpoint, complete object cleanup, Auth deletion, local-session cleanup, and destructive UI.
5. **Release hardening:** cross-user policy tests, Supabase advisors, mature-treatment benchmarks, offline/error testing, and real-device validation.

Do not combine Phase 2D and Phase 2E. Restore discovery must exist first so automatic sign-in evaluation cannot upload an empty installation before presenting existing recovery points.

Minimum automated coverage includes:

- recovery-list ordering, keyset pagination, supported/unsupported schema presentation, and cross-user isolation;
- byte-length, path, metadata/envelope, checksum, canonical-order, relationship, and timeline validation failures;
- restore eligibility checked both before and inside the transaction;
- rollback after failures at every insertion stage and preservation of `app_installation` and SecureStore;
- restored tracker readability, preserved IDs, future ID allocation, and notification reconciliation outcomes;
- automatic state evaluation for local-empty/remote-empty, local-empty/remote-present, local-present/remote-empty, and local-present/remote-present cases;
- coordinator coalescing, navigation disposal, offline retry, expired-session, and unchanged-hash behavior;
- retention boundary fixtures covering UTC day, ISO-week, month, ties, missing buckets, and newest-snapshot protection;
- orphan grace-period and partial-cleanup retries;
- account deletion authorization, pagination, partial failures, retries, cascade verification, and preservation of local treatment data; and
- database grants and RLS proving that one authenticated user cannot list, download, insert metadata for, restore, or delete another user's backup.

Before deployment, run TypeScript, lint, iOS UI purity, Jest, local database policy tests, and Supabase security/performance advisors. Measure snapshot creation and restore with the mature-treatment fixture on a release-like iOS build and confirm cloud work does not regress startup, warm resume, IN/OUT, tray change, or treatment-plan-save behavior.

## Acceptance Criteria

- Core tracking remains fully usable while signed out, offline, uploading, or after an upload failure.
- In Phase 2E, sign-in enables foreground backup automatically without a second opt-in control.
- An empty installation with existing remote backups is not uploaded before restore is offered.
- Local saves complete without waiting for Supabase.
- A user can restore the latest or another retained snapshot only on an empty installation.
- Failed restore leaves local data unchanged.
- Successful restore preserves snapshot record IDs, restores notification settings, leaves installation/auth data untouched, and immediately produces a usable tracker state.
- Unsupported, corrupt, noncanonical, or operationally invalid snapshots are never imported.
- Automatic backup performs no continuous polling, requires no OS background task, and retries without blocking local work.
- Retention produces 7 daily, 8 weekly, and indefinite monthly recovery points when qualifying changed snapshots exist.
- Failed or partial retention never removes the protected newest recovery point, and incomplete objects are not shown as recovery points.
- One account cannot read, restore, or delete another account's backups.
- Deleting the cloud account removes all owned objects, metadata, and the Auth user while preserving local tracker data; signing out does not delete cloud data.
