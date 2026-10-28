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

-- Devices that get push reminders. profile_id = the kid (or grown-up) the device belongs to.
create table if not exists public.push_subscriptions (
  id text primary key default gen_random_uuid()::text,
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade default auth.uid(),
  profile_id text references public.family_profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_family_idx on public.push_subscriptions (family_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists "family can read" on public.push_subscriptions;
drop policy if exists "family can insert" on public.push_subscriptions;
drop policy if exists "family can update" on public.push_subscriptions;
drop policy if exists "family can delete" on public.push_subscriptions;
create policy "family can read" on public.push_subscriptions for select to authenticated using (family_id in (select public.my_family_ids()));
create policy "family can insert" on public.push_subscriptions for insert to authenticated with check (public.is_family_member(family_id));
create policy "family can update" on public.push_subscriptions for update to authenticated using (family_id in (select public.my_family_ids())) with check (family_id in (select public.my_family_ids()));
create policy "family can delete" on public.push_subscriptions for delete to authenticated using (family_id in (select public.my_family_ids()));
revoke all on public.push_subscriptions from anon;
revoke truncate, trigger, references on public.push_subscriptions from authenticated;
drop trigger if exists set_family_id on public.push_subscriptions;
create trigger set_family_id before insert on public.push_subscriptions for each row execute function public.set_family_id();

-- Which reminders already went out, so each is sent once. Only the server (service key) uses it.
create table if not exists public.reminder_log (
  family_id uuid not null references public.families (id) on delete cascade,
  slot text not null,
  sent_on date not null,
  sent_at timestamptz not null default now(),
  primary key (family_id, slot, sent_on)
);
alter table public.reminder_log enable row level security;
revoke all on public.reminder_log from anon, authenticated;

-- Every 15 minutes, ask the app to send any reminders that are due. The endpoint only
-- sends what's due at each family's local time, once, so extra calls are harmless.
create extension if not exists pg_net;
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'send-chore-reminders';
    perform cron.schedule('send-chore-reminders', '*/15 * * * *',
      $job$ select net.http_post(url := 'https://responsibilities-app.vercel.app/api/reminders/run', headers := '{"Content-Type": "application/json"}'::jsonb, body := '{}'::jsonb) $job$);
  end if;
end $$;

notify pgrst, 'reload schema';
