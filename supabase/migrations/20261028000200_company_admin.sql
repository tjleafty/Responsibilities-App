-- Company admin: plans, each family's subscription, and admin-only views of every family.
-- Needs 20261028000100 (app_admins, is_app_admin) first.

-- What families can buy. Prices are shown in the app; the payment provider charges them.
create table if not exists public.plans (
  id text primary key,
  name text not null,
  description text not null default '',
  price_cents integer not null default 0,
  billing_interval text not null default 'month' check (billing_interval in ('month', 'year')),
  trial_days integer not null default 0,
  -- The payment provider's id for this price (e.g. a Stripe price id), once billing is set up.
  provider_price_id text,
  is_active boolean not null default true,
  sort integer not null default 0,
  updated_at timestamptz not null default now()
);

-- One row per family. A family without a row is on a trial that started when it was created.
create table if not exists public.family_subscriptions (
  family_id uuid primary key references public.families (id) on delete cascade,
  plan_id text references public.plans (id) on delete set null,
  status text not null default 'trialing' check (status in ('trialing', 'active', 'past_due', 'canceled', 'comped', 'expired')),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  admin_note text,
  updated_at timestamptz not null default now()
);

alter table public.plans enable row level security;
alter table public.family_subscriptions enable row level security;

drop policy if exists "everyone can read active plans" on public.plans;
drop policy if exists "admins manage plans" on public.plans;
create policy "everyone can read active plans" on public.plans for select to anon, authenticated using (is_active or public.is_app_admin());
create policy "admins manage plans" on public.plans for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());

-- Families can see their own subscription; only admins (and the payment webhook, which uses the service key) change it.
drop policy if exists "families read their subscription" on public.family_subscriptions;
drop policy if exists "admins manage subscriptions" on public.family_subscriptions;
create policy "families read their subscription" on public.family_subscriptions for select to authenticated
  using (family_id in (select public.my_family_ids()) or public.is_app_admin());
create policy "admins manage subscriptions" on public.family_subscriptions for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());

revoke all on public.family_subscriptions from anon;
revoke insert, update, delete, truncate, trigger, references on public.plans from anon;
revoke truncate, trigger, references on public.plans, public.family_subscriptions from authenticated;

drop trigger if exists set_updated_at on public.plans;
create trigger set_updated_at before update on public.plans for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.family_subscriptions;
create trigger set_updated_at before update on public.family_subscriptions for each row execute function public.set_updated_at();

-- Every family with its grown-ups, size, activity and plan. Admins only.
create or replace function public.admin_family_overview()
returns table (
  family_id uuid, family_name text, created_at timestamptz, member_emails text[], members integer,
  kids integer, chores integer, completions_30d integer, last_active timestamptz,
  plan_id text, status text, trial_ends_at timestamptz, current_period_end timestamptz, admin_note text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_app_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  return query
  select f.id, f.name, f.created_at,
    coalesce((select array_agg(m.email order by m.joined_at) from public.family_members m where m.family_id = f.id), '{}'),
    (select count(*)::int from public.family_members m where m.family_id = f.id),
    (select count(*)::int from public.family_profiles p where p.family_id = f.id and p.profile_type = 'child' and p.is_active),
    (select count(*)::int from public.chores c where c.family_id = f.id and c.is_active),
    (select count(*)::int from public.chore_completions cc where cc.family_id = f.id and cc.created_at > now() - interval '30 days'),
    greatest(
      (select max(cc.updated_at) from public.chore_completions cc where cc.family_id = f.id),
      (select max(u.last_sign_in_at) from public.family_members m join auth.users u on u.id = m.user_id where m.family_id = f.id)
    ),
    s.plan_id,
    coalesce(s.status, 'trialing'),
    coalesce(s.trial_ends_at, f.created_at + make_interval(days => coalesce((select max(p.trial_days) from public.plans p where p.is_active), 14))),
    s.current_period_end,
    s.admin_note
  from public.families f
  left join public.family_subscriptions s on s.family_id = f.id
  order by f.created_at desc;
end;
$$;

revoke execute on function public.admin_family_overview() from public, anon;
grant execute on function public.admin_family_overview() to authenticated;

-- Every new family starts a free trial as long as the longest active plan's trial (14 days if none).
create or replace function public.start_family_trial() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.family_subscriptions (family_id, status, trial_ends_at)
  values (new.id, 'trialing', now() + make_interval(days => coalesce((select max(p.trial_days) from public.plans p where p.is_active), 14)))
  on conflict (family_id) do nothing;
  return new;
end;
$$;
revoke execute on function public.start_family_trial() from public, anon, authenticated;
drop trigger if exists start_family_trial on public.families;
create trigger start_family_trial after insert on public.families for each row execute function public.start_family_trial();

-- Starting plans; change prices in the admin dashboard.
insert into public.plans (id, name, description, price_cents, billing_interval, trial_days, sort) values
  ('family-monthly', 'Family (monthly)', 'Every kid and grown-up in one household.', 499, 'month', 14, 1),
  ('family-yearly', 'Family (yearly)', 'Every kid and grown-up in one household. Two months free.', 4990, 'year', 14, 2)
on conflict (id) do nothing;

-- Families that already exist get a fresh 14-day trial from today; the admins' own families are free.
insert into public.family_subscriptions (family_id, status, trial_ends_at)
  select f.id, 'trialing', now() + interval '14 days' from public.families f
on conflict (family_id) do nothing;
update public.family_subscriptions s set status = 'comped', admin_note = coalesce(s.admin_note, 'Company team')
  where s.family_id in (select m.family_id from public.family_members m join public.app_admins a on a.user_id = m.user_id)
    and s.provider_subscription_id is null;

notify pgrst, 'reload schema';
