drop index if exists public.backup_snapshots_user_created_at_idx;

create index backup_snapshots_user_created_at_idx
on public.backup_snapshots (user_id, created_at desc, id desc);
