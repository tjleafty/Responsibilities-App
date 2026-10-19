-- ChoreReward schema, adapted from the Overskill export (2026-10-18).
-- Every row belongs to the parent account that created it (owner_id).
-- Kids don't have their own logins: they pick their profile and PIN on the parent's signed-in device.

create table public.family_profiles (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  display_name text not null,
  profile_type text not null check (profile_type in ('parent', 'child')),
  theme_key text not null default 'sunny-room',
  pin_hash text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.goals (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  description text,
  prize text,
  reward_id text,
  frequency text not null,
  target_profile_id text not null,
  target_count numeric not null default 1,
  progress numeric not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.chores (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  frequency text not null,
  target_profile_id text not null,
  assigned_profile_ids text,
  subtasks text,
  reward text,
  reward_id text,
  reward_points numeric not null default 0,
  time_limit_minutes numeric,
  requires_verification boolean not null default false,
  random_assignment_enabled boolean not null default false,
  assignment_rotation_enabled boolean not null default false,
  assignment_change_frequency text not null default 'weekly',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The app writes these timestamps itself as ISO strings and uses '' for "not set", so they stay text.
create table public.chore_completions (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  chore_id text not null,
  profile_id text not null,
  period_key text not null,
  completed_task_ids text,
  status text not null default 'in_progress',
  started_at text,
  deadline_at text,
  completed_at text,
  verified_at text,
  reward_points_snapshot numeric not null default 0,
  review_status text default 'unreviewed',
  rejection_reason text,
  parent_feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.family_rewards (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  description text,
  reward_type text not null default 'participation',
  target_profile_id text,
  points_required numeric default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['family_profiles', 'goals', 'chores', 'chore_completions', 'family_rewards'] loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
    execute format('create index %I on public.%I (owner_id, created_at desc)', t || '_owner_idx', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "owner can read" on public.%I for select to authenticated using (owner_id = (select auth.uid()))', t);
    execute format('create policy "owner can insert" on public.%I for insert to authenticated with check (owner_id = (select auth.uid()))', t);
    execute format('create policy "owner can update" on public.%I for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))', t);
    execute format('create policy "owner can delete" on public.%I for delete to authenticated using (owner_id = (select auth.uid()))', t);
  end loop;
end;
$$;

create index chore_completions_chore_idx on public.chore_completions (chore_id, profile_id, period_key);
