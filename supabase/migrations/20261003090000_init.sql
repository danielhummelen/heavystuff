-- Heavystuff schema. Tables mirror src/data/types.ts (camelCase -> snake_case, `order` -> `sort_order`).
-- Timestamps are client epoch milliseconds (bigint) so records round-trip unchanged.
-- Sync model (see src/sync/): every write gets a new `rev` from a global sequence; clients pull rows with
-- rev > their cursor. Hard deletes leave a tombstone in `deletions` so other devices can pull them too.

create sequence public.sync_rev;

create table public.profiles (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  settings jsonb not null default '{}'::jsonb,
  created_at bigint not null,
  updated_at bigint not null,
  rev bigint not null default 0
);
-- One profile per account.
create unique index profiles_user_id_key on public.profiles (user_id);

create table public.exercises (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  profile_id text not null,
  name text not null,
  category text not null,
  equipment text not null,
  is_bodyweight boolean not null default false,
  default_rest_sec integer,
  is_preset boolean not null default false,
  archived boolean not null default false,
  created_at bigint not null,
  updated_at bigint not null,
  rev bigint not null default 0
);

create table public.templates (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  profile_id text not null,
  name text not null,
  exercise_ids jsonb not null default '[]'::jsonb,
  created_at bigint not null,
  updated_at bigint not null,
  rev bigint not null default 0
);

create table public.sessions (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  profile_id text not null,
  name text not null default '',
  notes text not null default '',
  status text not null check (status in ('active', 'done')),
  started_at bigint not null,
  ended_at bigint,
  template_id text,
  created_at bigint not null,
  updated_at bigint not null,
  rev bigint not null default 0
);

create table public.session_exercises (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  profile_id text not null,
  session_id text not null,
  exercise_id text not null,
  sort_order double precision not null default 0,
  created_at bigint not null,
  updated_at bigint not null,
  rev bigint not null default 0
);

create table public.workout_sets (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  profile_id text not null,
  session_id text not null,
  session_exercise_id text not null,
  exercise_id text not null,
  sort_order double precision not null default 0,
  weight double precision not null,
  reps integer not null,
  rpe double precision,
  rir double precision,
  is_warmup boolean not null default false,
  is_drop_set boolean not null default false,
  to_failure boolean not null default false,
  notes text not null default '',
  completed_at bigint not null,
  created_at bigint not null,
  updated_at bigint not null,
  rev bigint not null default 0
);

create table public.deletions (
  table_name text not null,
  row_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  rev bigint not null default nextval('public.sync_rev'),
  primary key (table_name, row_id)
);

-- Sync triggers ---------------------------------------------------------------------------------

-- Stamps a new rev on every write and ignores stale updates (last write wins by client updated_at).
create function public.sync_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.updated_at < old.updated_at then
      return null;
    end if;
    new.user_id := old.user_id;
  end if;
  new.rev := nextval('public.sync_rev');
  return new;
end;
$$;

create function public.sync_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.deletions where table_name = tg_table_name and row_id = new.id;
  return null;
end;
$$;

create function public.sync_after_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.deletions (table_name, row_id, user_id)
  values (tg_table_name, old.id, old.user_id)
  on conflict (table_name, row_id)
  do update set rev = nextval('public.sync_rev'), user_id = excluded.user_id;
  return null;
end;
$$;

revoke execute on function public.sync_before_write(), public.sync_after_insert(), public.sync_after_delete() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'exercises', 'templates', 'sessions', 'session_exercises', 'workout_sets'] loop
    execute format('create trigger sync_before_write before insert or update on public.%I for each row execute function public.sync_before_write()', t);
    execute format('create trigger sync_after_insert after insert on public.%I for each row execute function public.sync_after_insert()', t);
    execute format('create trigger sync_after_delete after delete on public.%I for each row execute function public.sync_after_delete()', t);
    execute format('create index %I on public.%I (user_id, rev)', t || '_user_rev_idx', t);

    -- Row level security: users only ever see and modify their own rows.
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end;
$$;

create index deletions_user_rev_idx on public.deletions (user_id, rev);
alter table public.deletions enable row level security;
create policy "own rows" on public.deletions for select to authenticated using ((select auth.uid()) = user_id);
grant select on public.deletions to authenticated;
revoke all on public.deletions from anon;

-- Realtime: clients get notified of changes and then pull.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.profiles, public.exercises, public.templates, public.sessions,
      public.session_exercises, public.workout_sets, public.deletions;
  end if;
end;
$$;
