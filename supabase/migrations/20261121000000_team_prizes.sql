-- Team prizes: a grown-up marks a prize as shared by some kids, and each of them can put
-- points into the prize's jar. When the jar is full it waits for a grown-up's OK.
--   held:     in the jar, the kid can still take it back
--   pending:  the jar is full and waiting for a grown-up
--   granted:  a grown-up said yes; the points are spent
--   returned: taken back by the kid, or a grown-up said not now
-- Run this whole file in the Supabase SQL editor.

-- JSON array of the kids who share the prize. Empty or null means a regular prize.
alter table public.family_rewards add column if not exists team_profile_ids text;

create table if not exists public.prize_pledges (
  id text primary key default gen_random_uuid()::text,
  family_id uuid not null references public.families (id) on delete cascade,
  -- No foreign key, so spent points stay spent if the prize is deleted later.
  reward_id text not null,
  profile_id text not null references public.family_profiles (id) on delete cascade,
  points integer not null check (points > 0),
  status text not null default 'held' check (status in ('held', 'pending', 'granted', 'returned')),
  parent_note text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists prize_pledges_family_idx on public.prize_pledges (family_id, created_at desc);

alter table public.prize_pledges enable row level security;
drop policy if exists "family can read" on public.prize_pledges;
drop policy if exists "family can insert" on public.prize_pledges;
drop policy if exists "family can update" on public.prize_pledges;
drop policy if exists "family can delete" on public.prize_pledges;
create policy "family can read" on public.prize_pledges for select to authenticated using (family_id in (select public.my_family_ids()));
create policy "family can insert" on public.prize_pledges for insert to authenticated with check (public.is_family_member(family_id));
create policy "family can update" on public.prize_pledges for update to authenticated using (family_id in (select public.my_family_ids())) with check (family_id in (select public.my_family_ids()));
create policy "family can delete" on public.prize_pledges for delete to authenticated using (family_id in (select public.my_family_ids()));
revoke all on public.prize_pledges from anon;
revoke truncate, trigger, references on public.prize_pledges from authenticated;
grant select, insert, update, delete on public.prize_pledges to authenticated;

drop trigger if exists set_family_id on public.prize_pledges;
create trigger set_family_id before insert on public.prize_pledges for each row execute function public.set_family_id();
drop trigger if exists set_updated_at on public.prize_pledges;
create trigger set_updated_at before update on public.prize_pledges for each row execute function public.set_updated_at();

-- Lets the app see the new table and column right away.
notify pgrst, 'reload schema';
