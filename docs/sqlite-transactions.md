# SQLite Transaction Policy

## Purpose

SQLite is the app's on-device source of truth. Transaction boundaries must preserve treatment,
tray-period, and wear-punch invariants when lifecycle refreshes or user actions overlap. Normal
tracker actions remain local-first and must not wait for network work.

This document defines the shared transaction policy for repository and migration code. Feature
documents may add stricter requirements but must not weaken these rules.

## Mutation Classes

### Single-statement mutations

Keep a mutation in one conditional SQL statement when SQLite can validate and apply it atomically.
The tracker IN/OUT toggle, undo, and redo paths use this pattern. Their predicates must reject stale
state, and they do not need an exclusive transaction merely to make the search results uniform.

### User-initiated multi-step mutations

On iOS and Android, every user-initiated mutation that requires multiple reads or writes must use
`withExclusiveTransactionAsync` through the shared `withUserMutationTransaction` helper.

Every query in the operation must use the transaction-scoped object passed to the callback. Do not
read or write through the root `SQLiteDatabase` while the callback is active. Keeping all operation
queries scoped prevents unrelated async work on the shared connection from joining the transaction
and being committed or rolled back with it.

Keep exclusive transactions short:

- perform parsing and other pure computation before opening the transaction when practical;
- do not make network requests, schedule notifications, or perform unrelated platform work inside
  the transaction;
- re-read state needed for conflict validation after the transaction begins; and
- let lock or stale-state conflicts fail cleanly rather than adding automatic retries.

Current multi-step mutation examples include initial treatment setup, tray changes, time
corrections, and app reset.

## Web Limitation

Expo SQLite 57 does not support `withExclusiveTransactionAsync` on web. Shared repositories use
`withTransactionAsync` there so existing web behavior continues, but this fallback does not provide
the native isolation guarantee. Do not describe it as equivalent isolation. If web becomes a
supported correctness target for overlapping writes, define and test a separate serialization
strategy before relying on these repository paths.

## Startup Migrations

Migrations run during `SQLiteProvider` initialization before app consumers receive the database.
They may continue using `withTransactionAsync` because normal application queries cannot overlap
them. Migration code must still keep schema changes and the corresponding `user_version` update in
the same transaction.

Migrations must not silently rewrite invalid treatment history. Check legacy data before adding a
new invariant, fail with a clear integrity error when existing rows violate it, and leave the prior
schema version intact.

## Database Constraints

Use inexpensive SQLite constraints and indexes as a final defense for critical invariants. The
database has a partial unique index on `tray_periods(treatment_id)` where `ended_at IS NULL`, which
allows historical ended periods while preventing more than one active tray period per treatment.
Repository validation remains necessary so normal conflicts can produce useful application errors.

## Test Expectations

Changes to multi-step mutations should verify:

- all reads and writes use the callback-scoped transaction object;
- a failed operation rolls back all of its own changes;
- unrelated root-connection work cannot join the operation transaction;
- tray-change/toggle and correction/toggle overlap cannot leave partial or invalid history; and
- new database constraints accept valid historical data, reject invalid active data, and reject
  invalid legacy data during migration without rewriting it.

Run `npm run validate` after changing transaction, repository, or migration behavior, then smoke-test
the affected native actions on iOS.

## Reference

Expo SQLite 57 transaction behavior:
https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/#executing-queries-within-an-async-transaction
