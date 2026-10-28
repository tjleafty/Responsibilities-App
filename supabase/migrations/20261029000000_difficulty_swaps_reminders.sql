-- Chore difficulty. Points scale with the family's multipliers (families.settings.points.multipliers).
alter table public.chores add column if not exists difficulty text check (difficulty in ('easy', 'medium', 'hard'));

-- Kids asking to swap chores with a sibling, hand one off for points, or take one over
-- for bonus points. Nothing changes until a grown-up approves.
create table if not exists public.chore_swaps (
  id text primary key default gen_random_uuid()::text,
  family_id uuid not null references public.families (id) on delete cascade,
  kind text not null check (kind in ('swap', 'handoff', 'takeover')),
  from_profile_id text not null references public.family_profiles (id) on delete cascade,
  to_profile_id text not null references public.family_profiles (id) on delete cascade,
  -- The asking kid's chore they give away (swap, handoff) and the period it's for.
  give_chore_id text references public.chores (id) on delete cascade,
  give_period_key text,
  -- The sibling's chore the asking kid takes on (swap, takeover) and its period.
  take_chore_id text references public.chores (id) on delete cascade,
  take_period_key text,
  -- handoff: points the asking kid pays the sibling. takeover: bonus points the asking kid asks for.
  points integer not null default 0 check (points >= 0),
  message text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'canceled')),
  parent_note text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists chore_swaps_family_idx on public.chore_swaps (family_id, created_at desc);

alter table public.chore_swaps enable row level security;
drop policy if exists "family can read" on public.chore_swaps;
drop policy if exists "family can insert" on public.chore_swaps;
drop policy if exists "family can update" on public.chore_swaps;
drop policy if exists "family can delete" on public.chore_swaps;
create policy "family can read" on public.chore_swaps for select to authenticated using (family_id in (select public.my_family_ids()));
create policy "family can insert" on public.chore_swaps for insert to authenticated with check (public.is_family_member(family_id));
create policy "family can update" on public.chore_swaps for update to authenticated using (family_id in (select public.my_family_ids())) with check (family_id in (select public.my_family_ids()));
create policy "family can delete" on public.chore_swaps for delete to authenticated using (family_id in (select public.my_family_ids()));
revoke all on public.chore_swaps from anon;
revoke truncate, trigger, references on public.chore_swaps from authenticated;

drop trigger if exists set_family_id on public.chore_swaps;
create trigger set_family_id before insert on public.chore_swaps for each row execute function public.set_family_id();
drop trigger if exists set_updated_at on public.chore_swaps;
create trigger set_updated_at before update on public.chore_swaps for each row execute function public.set_updated_at();
