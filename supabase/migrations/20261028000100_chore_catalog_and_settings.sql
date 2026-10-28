-- Starter chore list in the database, parent suggestions for it, super admins who
-- review them, family-wide settings and kids' birth years.

-- Super admins (the company). Add more with:
--   insert into public.app_admins (user_id, email) select id, email from auth.users where email = 'someone@example.com';
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  added_at timestamptz not null default now()
);

create or replace function public.is_app_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid())
$$;

-- The starter list every household picks from. Households get their own copy of a
-- chore when they add it (public.chores), so their edits never change this list.
create table if not exists public.chore_catalog (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  frequency text not null default 'daily' check (frequency in ('daily', 'weekly', 'monthly')),
  subtasks text not null default '[]',
  min_age integer,
  max_age integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists chore_catalog_title_idx on public.chore_catalog (lower(title));

-- New chores and steps parents made that aren't on the starter list yet.
create table if not exists public.chore_suggestions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families (id) on delete set null default public.current_family_id(),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  kind text not null check (kind in ('chore', 'steps')),
  title text not null,
  frequency text not null default 'daily',
  subtasks text not null default '[]',
  catalog_id uuid references public.chore_catalog (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists chore_suggestions_status_idx on public.chore_suggestions (status, created_at desc);
-- One open suggestion per family for the same chore.
create unique index if not exists chore_suggestions_open_idx on public.chore_suggestions (family_id, kind, lower(title)) where status = 'pending';

alter table public.app_admins enable row level security;
alter table public.chore_catalog enable row level security;
alter table public.chore_suggestions enable row level security;

drop policy if exists "admins can read" on public.app_admins;
create policy "admins can read" on public.app_admins for select to authenticated using (user_id = (select auth.uid()) or public.is_app_admin());

drop policy if exists "everyone can read" on public.chore_catalog;
drop policy if exists "admins can change" on public.chore_catalog;
create policy "everyone can read" on public.chore_catalog for select to authenticated using (is_active or public.is_app_admin());
create policy "admins can change" on public.chore_catalog for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());

drop policy if exists "families can suggest" on public.chore_suggestions;
drop policy if exists "families and admins can read" on public.chore_suggestions;
drop policy if exists "admins can review" on public.chore_suggestions;
drop policy if exists "admins can delete" on public.chore_suggestions;
create policy "families can suggest" on public.chore_suggestions for insert to authenticated
  with check (created_by = (select auth.uid()) and status = 'pending' and (family_id is null or public.is_family_member(family_id)));
create policy "families and admins can read" on public.chore_suggestions for select to authenticated
  using (family_id in (select public.my_family_ids()) or public.is_app_admin());
create policy "admins can review" on public.chore_suggestions for update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
create policy "admins can delete" on public.chore_suggestions for delete to authenticated using (public.is_app_admin());

revoke all on public.app_admins, public.chore_catalog, public.chore_suggestions from anon;
revoke truncate, trigger, references on public.app_admins, public.chore_catalog, public.chore_suggestions from authenticated;
revoke execute on function public.is_app_admin() from public, anon;
grant execute on function public.is_app_admin() to authenticated;

drop trigger if exists set_updated_at on public.chore_catalog;
create trigger set_updated_at before update on public.chore_catalog for each row execute function public.set_updated_at();

-- Family-wide settings (points, prize rules, notifications, celebrations) as JSON.
alter table public.families add column if not exists settings jsonb not null default '{}'::jsonb;

-- Kids' birth years, for age-appropriate chore ideas.
alter table public.family_profiles add column if not exists birth_year integer;

-- The 27 chores the app started with, tagged with the ages they suit best.
insert into public.chore_catalog (title, frequency, min_age, max_age) values
  ('Make your bed', 'daily', 4, 12),
  ('Get ready for bed', 'daily', 4, 12),
  ('Take shower/bath', 'daily', 7, 17),
  ('Personal morning prayer', 'daily', 4, 17),
  ('Personal evening prayer', 'daily', 4, 17),
  ('Read book', 'daily', 4, 17),
  ('Clean bedroom', 'daily', 4, 17),
  ('Set table for dinner', 'daily', 4, 12),
  ('Help make dinner', 'daily', 7, 17),
  ('Help clean up dinner', 'daily', 5, 17),
  ('Clean dining room', 'daily', 7, 17),
  ('Clean kitchen counters', 'daily', 6, 17),
  ('Load dishwasher', 'daily', 7, 17),
  ('Unload dishwasher', 'daily', 6, 17),
  ('Empty out all trashes', 'daily', 7, 17),
  ('Take out kitchen trash', 'daily', 8, 17),
  ('Take out recycling', 'daily', 6, 17),
  ('Sweep porch', 'daily', 6, 17),
  ('Put clothes in washing machine', 'daily', 9, 17),
  ('Put clothes in dryer', 'daily', 9, 17),
  ('Fold clothes and put away', 'weekly', 6, 17),
  ('Wash bedding', 'weekly', 10, 17),
  ('Clean bathrooms', 'weekly', 9, 17),
  ('Clean living room', 'weekly', 6, 17),
  ('Sweep/vacuum floors', 'weekly', 7, 17),
  ('Bring trash bins in', 'weekly', 7, 17),
  ('Take trash bins to the curb', 'weekly', 9, 17)
on conflict do nothing;

-- TJ is the first super admin.
insert into public.app_admins (user_id, email)
  select id, email from auth.users where lower(email) = 'tjleafty@gmail.com'
on conflict do nothing;

notify pgrst, 'reload schema';
