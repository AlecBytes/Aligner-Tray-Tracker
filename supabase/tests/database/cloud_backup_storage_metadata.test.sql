begin;

create extension if not exists pgtap with schema extensions;

set local search_path = public, extensions, pg_catalog;

select no_plan();

select has_function(
  'public',
  'rls_auto_enable',
  array[]::text[],
  'automatic RLS function exists'
);

select ok(
  (
    select p.prosecdef
      and 'search_path=pg_catalog' = any(coalesce(p.proconfig, array[]::text[]))
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'rls_auto_enable'
      and p.pronargs = 0
  ),
  'automatic RLS function is SECURITY DEFINER with a fixed pg_catalog search path'
);

select ok(
  not has_function_privilege('anon', 'public.rls_auto_enable()', 'execute'),
  'anonymous users cannot execute the automatic RLS function'
);

select ok(
  not has_function_privilege('authenticated', 'public.rls_auto_enable()', 'execute'),
  'authenticated users cannot execute the automatic RLS function'
);

select ok(
  not has_function_privilege('service_role', 'public.rls_auto_enable()', 'execute'),
  'service role cannot call the automatic RLS function directly'
);

select ok(
  exists (
    select 1
    from pg_event_trigger
    where evtname = 'ensure_rls'
      and evtevent = 'ddl_command_end'
      and evtenabled = 'O'
  ),
  'automatic RLS event trigger is enabled'
);

create table public.cloud_backup_rls_probe (id bigint primary key);

select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.cloud_backup_rls_probe'::regclass
  ),
  'automatic RLS trigger protects newly created public tables'
);

drop table public.cloud_backup_rls_probe;

select ok(
  exists (
    select 1
    from storage.buckets
    where id = 'backup-snapshots'
      and name = 'backup-snapshots'
  ),
  'backup snapshot bucket exists'
);

select ok(
  not (select public from storage.buckets where id = 'backup-snapshots'),
  'backup snapshot bucket is private'
);

select is(
  (select file_size_limit from storage.buckets where id = 'backup-snapshots'),
  52428800::bigint,
  'backup snapshot bucket has a 50 MiB object limit'
);

select is(
  (select allowed_mime_types from storage.buckets where id = 'backup-snapshots'),
  array['application/json']::text[],
  'backup snapshot bucket accepts only JSON'
);

select has_table(
  'public',
  'backup_snapshots',
  'backup snapshot metadata table exists'
);

select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.backup_snapshots'::regclass
  ),
  'backup snapshot metadata has RLS enabled'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.backup_snapshots'::regclass
      and conname = 'backup_snapshots_pkey'
      and contype = 'p'
  ),
  'backup snapshot metadata has its primary key'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.backup_snapshots'::regclass
      and conname = 'backup_snapshots_user_id_fkey'
      and contype = 'f'
  ),
  'backup snapshot metadata references auth.users'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.backup_snapshots'::regclass
      and conname = 'backup_snapshots_storage_path_key'
      and contype = 'u'
  ),
  'backup storage paths are unique'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.backup_snapshots'::regclass
      and conname = 'backup_snapshots_user_content_hash_key'
      and contype = 'u'
  ),
  'completed content hashes are unique per user'
);

select ok(
  to_regclass('public.backup_snapshots_user_created_at_idx') is not null,
  'latest-backup lookup index exists'
);

select ok(
  has_table_privilege('authenticated', 'public.backup_snapshots', 'select'),
  'authenticated users can select backup metadata'
);

select ok(
  has_column_privilege('authenticated', 'public.backup_snapshots', 'id', 'insert'),
  'authenticated users can insert client-generated snapshot IDs'
);

select ok(
  not has_column_privilege('authenticated', 'public.backup_snapshots', 'created_at', 'insert'),
  'authenticated users cannot supply created_at'
);

select ok(
  not has_table_privilege('authenticated', 'public.backup_snapshots', 'update'),
  'authenticated users cannot update completed metadata'
);

select ok(
  not has_table_privilege('authenticated', 'public.backup_snapshots', 'delete'),
  'authenticated users cannot delete completed metadata'
);

select ok(
  not has_table_privilege('anon', 'public.backup_snapshots', 'select'),
  'anonymous users have no metadata read grant'
);

select ok(
  not has_table_privilege('service_role', 'public.backup_snapshots', 'select'),
  'service role receives no unnecessary metadata grant'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'backup_snapshots'
      and policyname = 'Users can read their completed backup metadata'
      and cmd = 'SELECT'
  ),
  'metadata has a dedicated authenticated SELECT policy'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'backup_snapshots'
      and policyname = 'Users can commit completed backup metadata'
      and cmd = 'INSERT'
  ),
  'metadata has a dedicated authenticated INSERT policy'
);

select ok(
  not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'backup_snapshots'
      and cmd in ('UPDATE', 'DELETE', 'ALL')
  ),
  'metadata has no update, delete, or catch-all policy'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can read their backup objects'
      and cmd = 'SELECT'
  ),
  'Storage has a dedicated backup-object SELECT policy'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can upload immutable backup objects'
      and cmd = 'INSERT'
  ),
  'Storage has a dedicated immutable upload policy'
);

select ok(
  not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like '%backup object%'
      and cmd in ('UPDATE', 'DELETE', 'ALL')
  ),
  'Storage has no backup-object update, delete, or catch-all policy'
);

insert into auth.users (id, email)
values
  ('11111111-1111-4111-8111-111111111111', 'backup-user-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'backup-user-b@example.test');

insert into storage.objects (bucket_id, name, owner_id)
values (
  'backup-snapshots',
  '22222222-2222-4222-8222-222222222222/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.json',
  '22222222-2222-4222-8222-222222222222'
);

insert into public.backup_snapshots (
  id,
  user_id,
  storage_path,
  schema_version,
  app_version,
  content_hash,
  payload_bytes
)
values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '22222222-2222-4222-8222-222222222222',
  '22222222-2222-4222-8222-222222222222/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.json',
  1,
  '1.0.0',
  repeat('b', 64),
  256
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);

select throws_ok(
  $$
    insert into storage.objects (bucket_id, name, owner_id)
    values (
      'backup-snapshots',
      '22222222-2222-4222-8222-222222222222/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.json',
      '11111111-1111-4111-8111-111111111111'
    )
  $$,
  '42501',
  null,
  'User A cannot upload beneath User B namespace'
);

select throws_ok(
  $$
    insert into storage.objects (bucket_id, name, owner_id)
    values (
      'backup-snapshots',
      '11111111-1111-4111-8111-111111111111/nested/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.json',
      '11111111-1111-4111-8111-111111111111'
    )
  $$,
  '42501',
  null,
  'nested backup object paths are rejected'
);

select lives_ok(
  $$
    insert into storage.objects (bucket_id, name, owner_id)
    values (
      'backup-snapshots',
      '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.json',
      '11111111-1111-4111-8111-111111111111'
    )
  $$,
  'User A can upload a correctly namespaced immutable object'
);

select is(
  (
    select count(*)
    from storage.objects
    where bucket_id = 'backup-snapshots'
  ),
  1::bigint,
  'User A can list only User A objects'
);

select throws_ok(
  $$
    insert into public.backup_snapshots (
      id,
      user_id,
      storage_path,
      schema_version,
      app_version,
      content_hash,
      payload_bytes
    )
    values (
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      '11111111-1111-4111-8111-111111111111',
      '11111111-1111-4111-8111-111111111111/cccccccc-cccc-4ccc-8ccc-cccccccccccc.json',
      1,
      '1.0.0',
      repeat('c', 64),
      128
    )
  $$,
  '42501',
  null,
  'metadata cannot be completed before its Storage object exists'
);

select throws_ok(
  $$
    insert into public.backup_snapshots (
      id,
      user_id,
      storage_path,
      schema_version,
      app_version,
      content_hash,
      payload_bytes
    )
    values (
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      '22222222-2222-4222-8222-222222222222',
      '22222222-2222-4222-8222-222222222222/dddddddd-dddd-4ddd-8ddd-dddddddddddd.json',
      1,
      '1.0.0',
      repeat('d', 64),
      128
    )
  $$,
  '42501',
  null,
  'User A cannot commit metadata for User B even when User B object exists'
);

select lives_ok(
  $$
    insert into public.backup_snapshots (
      id,
      user_id,
      storage_path,
      schema_version,
      app_version,
      content_hash,
      payload_bytes
    )
    values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '11111111-1111-4111-8111-111111111111',
      '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.json',
      1,
      '1.0.0',
      repeat('a', 64),
      128
    )
  $$,
  'User A can commit metadata after its owned object exists'
);

select is(
  (select count(*) from public.backup_snapshots),
  1::bigint,
  'User A can read only User A completed metadata'
);

select throws_ok(
  $$
    update public.backup_snapshots
    set app_version = '9.9.9'
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  $$,
  '42501',
  null,
  'completed metadata cannot be updated by its owner'
);

select throws_ok(
  $$
    delete from public.backup_snapshots
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  $$,
  '42501',
  null,
  'completed metadata cannot be deleted by its owner'
);

select throws_ok(
  $$
    insert into storage.objects (bucket_id, name, owner_id)
    values (
      'backup-snapshots',
      '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.json',
      '11111111-1111-4111-8111-111111111111'
    )
    on conflict (bucket_id, name) do update
      set owner_id = excluded.owner_id
  $$,
  '42501',
  null,
  'Storage upsert cannot overwrite an existing backup object'
);

select is_empty(
  $$
    update storage.objects
    set name = '11111111-1111-4111-8111-111111111111/dddddddd-dddd-4ddd-8ddd-dddddddddddd.json'
    where bucket_id = 'backup-snapshots'
      and name = '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.json'
    returning 1
  $$,
  'backup objects cannot be overwritten or renamed by their owner'
);

select throws_ok(
  $$
    delete from storage.objects
    where bucket_id = 'backup-snapshots'
      and name = '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.json'
    returning 1
  $$,
  '42501',
  'Direct deletion from storage tables is not allowed. Use the Storage API instead.',
  'backup objects cannot be deleted by their owner'
);

reset role;

select is(
  (
    select created_at
    from public.backup_snapshots
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ),
  now(),
  'completed metadata uses the server transaction time'
);

select throws_ok(
  $$
    insert into public.backup_snapshots (
      id, user_id, storage_path, schema_version, app_version, content_hash, payload_bytes
    )
    values (
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222/ffffffff-ffff-4fff-8fff-ffffffffffff.json',
      1,
      '1.0.0',
      repeat('f', 64),
      1
    )
  $$,
  '23514',
  null,
  'metadata paths must agree with their owning user and snapshot ID'
);

select throws_ok(
  $$
    insert into public.backup_snapshots (
      id, user_id, storage_path, schema_version, app_version, content_hash, payload_bytes
    )
    values (
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      '11111111-1111-4111-8111-111111111111',
      '11111111-1111-4111-8111-111111111111/dddddddd-dddd-4ddd-8ddd-dddddddddddd.json',
      1,
      '1.0.0',
      repeat('d', 64),
      -1
    )
  $$,
  '23514',
  null,
  'negative payload sizes are rejected'
);

select throws_ok(
  $$
    insert into public.backup_snapshots (
      id, user_id, storage_path, schema_version, app_version, content_hash, payload_bytes
    )
    values (
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      '11111111-1111-4111-8111-111111111111',
      '11111111-1111-4111-8111-111111111111/dddddddd-dddd-4ddd-8ddd-dddddddddddd.json',
      1,
      '1.0.0',
      'not-a-sha-256-hash',
      1
    )
  $$,
  '23514',
  null,
  'invalid content hashes are rejected'
);

select throws_ok(
  $$
    insert into public.backup_snapshots (
      id, user_id, storage_path, schema_version, app_version, content_hash, payload_bytes
    )
    values (
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      '11111111-1111-4111-8111-111111111111',
      '11111111-1111-4111-8111-111111111111/dddddddd-dddd-4ddd-8ddd-dddddddddddd.json',
      0,
      '1.0.0',
      repeat('d', 64),
      1
    )
  $$,
  '23514',
  null,
  'nonpositive schema versions are rejected'
);

select throws_ok(
  $$
    insert into public.backup_snapshots (
      id, user_id, storage_path, schema_version, app_version, content_hash, payload_bytes
    )
    values (
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      '11111111-1111-4111-8111-111111111111',
      '11111111-1111-4111-8111-111111111111/dddddddd-dddd-4ddd-8ddd-dddddddddddd.json',
      1,
      '   ',
      repeat('d', 64),
      1
    )
  $$,
  '23514',
  null,
  'blank app versions are rejected'
);

select throws_ok(
  $$
    insert into public.backup_snapshots (
      id, user_id, storage_path, schema_version, app_version, content_hash, payload_bytes
    )
    values (
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      '11111111-1111-4111-8111-111111111111',
      '11111111-1111-4111-8111-111111111111/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee.json',
      1,
      '1.0.0',
      repeat('a', 64),
      1
    )
  $$,
  '23505',
  null,
  'duplicate completed content hashes are rejected per user'
);

select throws_ok(
  $$
    insert into public.backup_snapshots (
      id, user_id, storage_path, schema_version, app_version, content_hash, payload_bytes
    )
    values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '11111111-1111-4111-8111-111111111111',
      '11111111-1111-4111-8111-111111111111/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.json',
      1,
      '1.0.0',
      repeat('f', 64),
      1
    )
  $$,
  '23505',
  null,
  'duplicate snapshot storage paths are rejected'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.backup_snapshots),
  1::bigint,
  'User B can read User B metadata but not User A metadata'
);

select is(
  (
    select count(*)
    from storage.objects
    where bucket_id = 'backup-snapshots'
  ),
  1::bigint,
  'User B can list User B objects but not User A objects'
);

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  $$select * from public.backup_snapshots$$,
  '42501',
  null,
  'anonymous metadata reads are denied'
);

select throws_ok(
  $$
    insert into public.backup_snapshots (
      id, user_id, storage_path, schema_version, app_version, content_hash, payload_bytes
    )
    values (
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
      '11111111-1111-4111-8111-111111111111',
      '11111111-1111-4111-8111-111111111111/ffffffff-ffff-4fff-8fff-ffffffffffff.json',
      1,
      '1.0.0',
      repeat('f', 64),
      1
    )
  $$,
  '42501',
  null,
  'anonymous metadata inserts are denied'
);

select is(
  (
    select count(*)
    from storage.objects
    where bucket_id = 'backup-snapshots'
  ),
  0::bigint,
  'anonymous users cannot list backup objects'
);

select throws_ok(
  $$
    insert into storage.objects (bucket_id, name, owner_id)
    values (
      'backup-snapshots',
      '11111111-1111-4111-8111-111111111111/ffffffff-ffff-4fff-8fff-ffffffffffff.json',
      null
    )
  $$,
  '42501',
  null,
  'anonymous uploads are denied'
);

reset role;

select * from finish();
rollback;
