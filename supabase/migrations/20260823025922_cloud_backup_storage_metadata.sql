-- Keep SQL-created public tables protected even when a migration forgets to
-- enable RLS explicitly. This is Supabase's documented auto-enable trigger.
create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  cmd record;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table', 'partitioned table')
  loop
    if cmd.schema_name is not null
      and cmd.schema_name in ('public')
      and cmd.schema_name not in ('pg_catalog', 'information_schema')
      and cmd.schema_name not like 'pg_toast%'
      and cmd.schema_name not like 'pg_temp%'
    then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception
        when others then
          raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
    else
      raise log 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)',
        cmd.object_identity,
        cmd.schema_name;
    end if;
  end loop;
end;
$function$;

revoke execute on function public.rls_auto_enable()
from public, anon, authenticated, service_role;

drop event trigger if exists ensure_rls;
create event trigger ensure_rls
on ddl_command_end
when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
execute function public.rls_auto_enable();

-- Bucket configuration is data in Supabase's managed storage schema. Upsert it
-- so a reset or deliberate migration replay restores the private settings.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'backup-snapshots',
  'backup-snapshots',
  false,
  52428800,
  array['application/json']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.backup_snapshots (
  id uuid not null,
  user_id uuid not null,
  storage_path text not null,
  schema_version integer not null,
  app_version text not null,
  content_hash text not null,
  payload_bytes bigint not null,
  created_at timestamptz not null default now(),
  constraint backup_snapshots_pkey primary key (id),
  constraint backup_snapshots_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete cascade,
  constraint backup_snapshots_storage_path_key unique (storage_path),
  constraint backup_snapshots_user_content_hash_key unique (user_id, content_hash),
  constraint backup_snapshots_storage_path_matches_identity_check
    check (storage_path = user_id::text || '/' || id::text || '.json'),
  constraint backup_snapshots_schema_version_positive_check
    check (schema_version > 0),
  constraint backup_snapshots_app_version_not_blank_check
    check (btrim(app_version) <> ''),
  constraint backup_snapshots_content_hash_sha256_check
    check (content_hash ~ '^[0-9a-f]{64}$'),
  constraint backup_snapshots_payload_bytes_nonnegative_check
    check (payload_bytes >= 0)
);

create index if not exists backup_snapshots_user_created_at_idx
on public.backup_snapshots (user_id, created_at desc);

alter table public.backup_snapshots enable row level security;

revoke all on table public.backup_snapshots
from public, anon, authenticated, service_role;

grant select on table public.backup_snapshots to authenticated;
grant insert (
  id,
  user_id,
  storage_path,
  schema_version,
  app_version,
  content_hash,
  payload_bytes
) on public.backup_snapshots to authenticated;

drop policy if exists "Users can read their backup objects" on storage.objects;
create policy "Users can read their backup objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'backup-snapshots'
  and owner_id = (select auth.uid())::text
  and storage.foldername(name) = array[(select auth.uid())::text]
  and storage.filename(name) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$'
);

drop policy if exists "Users can upload immutable backup objects" on storage.objects;
create policy "Users can upload immutable backup objects"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'backup-snapshots'
  and owner_id = (select auth.uid())::text
  and storage.foldername(name) = array[(select auth.uid())::text]
  and storage.filename(name) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$'
);

drop policy if exists "Users can read their completed backup metadata" on public.backup_snapshots;
create policy "Users can read their completed backup metadata"
on public.backup_snapshots
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Users can commit completed backup metadata" on public.backup_snapshots;
create policy "Users can commit completed backup metadata"
on public.backup_snapshots
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from storage.objects as backup_object
    where backup_object.bucket_id = 'backup-snapshots'
      and backup_object.name = backup_snapshots.storage_path
      and backup_object.owner_id = (select auth.uid())::text
  )
);
