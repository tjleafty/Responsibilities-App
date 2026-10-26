-- Family sharing: more than one login can see and run the same family.
-- Every row now belongs to a family (family_id) instead of a single login (owner_id).
-- owner_id stays as "who created this row" and keeps its old default, so the old
-- owner-only rules can be restored if this ever needs rolling back.
-- Named families/family_members/family_invites because this database also holds an
-- older, unrelated "households" table.

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Our family',
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.family_members (
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  email text,
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id)
);
create index family_members_user_idx on public.family_members (user_id);

create table public.family_invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  -- Only a hash of the invite code is stored; the code itself lives in the link.
  code_hash text not null unique,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz
);
create index family_invites_family_idx on public.family_invites (family_id, created_at desc);

-- The families the signed-in login belongs to. Security definer so the rules on
-- family_members can use it without checking themselves in a loop.
create function public.my_family_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select family_id from public.family_members where user_id = (select auth.uid())
$$;

-- Same check for inserts. Volatile so it sees a family that set_family_id() created
-- for a brand-new login a moment earlier in the same insert.
create function public.is_family_member(fam uuid) returns boolean
language sql volatile security definer set search_path = '' as $$
  select exists (select 1 from public.family_members where family_id = fam and user_id = (select auth.uid()))
$$;

-- The family new rows go into: the one this login joined most recently.
create function public.current_family_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select family_id from public.family_members where user_id = (select auth.uid()) order by joined_at desc limit 1
$$;

-- Backfill: one family per login that already has data, with that login as its owner.
do $$
declare
  owner uuid;
  fam uuid;
begin
  for owner in
    select owner_id from public.family_profiles
    union select owner_id from public.chores
    union select owner_id from public.chore_completions
    union select owner_id from public.goals
    union select owner_id from public.family_rewards
  loop
    insert into public.families (created_by) values (owner) returning id into fam;
    insert into public.family_members (family_id, user_id, role, email)
      select fam, owner, 'owner', email from auth.users where id = owner;
  end loop;
end;
$$;

-- Gives a login with no family a new one, with them as its owner. Safe to call on every load.
create function public.ensure_family() returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  fam uuid := public.current_family_id();
begin
  if me is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if fam is null then
    insert into public.families (created_by) values (me) returning id into fam;
    insert into public.family_members (family_id, user_id, role, email) values (fam, me, 'owner', auth.jwt() ->> 'email');
  end if;
  return fam;
end;
$$;

create function public.set_family_id() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- A login saving its first row without a family gets one, so app versions that
  -- don't know about families keep working for brand-new sign-ups.
  if new.family_id is null then
    new.family_id := public.ensure_family();
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['family_profiles', 'goals', 'chores', 'chore_completions', 'family_rewards'] loop
    execute format('alter table public.%I add column family_id uuid references public.families (id) on delete cascade', t);
    execute format('update public.%I r set family_id = m.family_id from public.family_members m where m.user_id = r.owner_id and m.role = %L', t, 'owner');
    execute format('alter table public.%I alter column family_id set not null', t);
    execute format('create index %I on public.%I (family_id, created_at desc)', t || '_family_idx', t);
    execute format('create trigger set_family_id before insert on public.%I for each row execute function public.set_family_id()', t);
    execute format('drop policy "owner can read" on public.%I', t);
    execute format('drop policy "owner can insert" on public.%I', t);
    execute format('drop policy "owner can update" on public.%I', t);
    execute format('drop policy "owner can delete" on public.%I', t);
    execute format('create policy "family can read" on public.%I for select to authenticated using (family_id in (select public.my_family_ids()))', t);
    execute format('create policy "family can insert" on public.%I for insert to authenticated with check (public.is_family_member(family_id))', t);
    execute format('create policy "family can update" on public.%I for update to authenticated using (family_id in (select public.my_family_ids())) with check (family_id in (select public.my_family_ids()))', t);
    execute format('create policy "family can delete" on public.%I for delete to authenticated using (family_id in (select public.my_family_ids()))', t);
  end loop;
end;
$$;

-- Members can see their family, who is in it and its open invites. All changes go
-- through the functions below, so there are no insert/update/delete rules here.
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.family_invites enable row level security;
create policy "members can read" on public.families for select to authenticated using (id in (select public.my_family_ids()));
create policy "members can rename" on public.families for update to authenticated using (id in (select public.my_family_ids())) with check (id in (select public.my_family_ids()));
create policy "members can read" on public.family_members for select to authenticated using (family_id in (select public.my_family_ids()));
create policy "members can read" on public.family_invites for select to authenticated using (family_id in (select public.my_family_ids()));
create policy "members can cancel" on public.family_invites for delete to authenticated using (family_id in (select public.my_family_ids()));

-- Makes a new 7-day invite code for the caller's family. Only the code's hash is kept.
create function public.create_family_invite() returns table (code text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  fam uuid := public.current_family_id();
  new_code text := encode(extensions.gen_random_bytes(18), 'hex');
begin
  if fam is null then raise exception 'This login is not in a family yet.' using errcode = '42501'; end if;
  return query
    insert into public.family_invites (family_id, code_hash)
    values (fam, encode(extensions.digest(new_code, 'sha256'), 'hex'))
    returning new_code, family_invites.expires_at;
end;
$$;

-- What the invite page shows before someone signs in. Reveals nothing without a valid code.
create function public.family_invite_details(invite_code text) returns table (family_name text, invited_by text, expires_at timestamptz, status text)
language sql stable security definer set search_path = '' as $$
  select
    f.name,
    coalesce(
      (select p.display_name from public.family_profiles p where p.family_id = f.id and p.profile_type = 'parent' and p.owner_id = i.created_by order by p.created_at limit 1),
      (select p.display_name from public.family_profiles p where p.family_id = f.id and p.profile_type = 'parent' order by p.created_at limit 1)
    ),
    i.expires_at,
    case when i.accepted_at is not null then 'used' when i.expires_at < now() then 'expired' else 'open' end
  from public.family_invites i
  join public.families f on f.id = i.family_id
  where i.code_hash = encode(extensions.digest(invite_code, 'sha256'), 'hex')
$$;

-- Joins the caller to the invite's family. A login whose own family is still empty
-- leaves it (and it is removed); a login whose family already has kids or chores is
-- refused, so nobody's data is ever dropped by accepting an invite.
create function public.accept_family_invite(invite_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  invite public.family_invites;
  old_family uuid;
begin
  if me is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  select * into invite from public.family_invites
    where code_hash = encode(extensions.digest(invite_code, 'sha256'), 'hex') for update;
  if invite.id is null then raise exception 'invite_not_found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.family_members where family_id = invite.family_id and user_id = me) then
    return invite.family_id;
  end if;
  if invite.accepted_at is not null then raise exception 'invite_used' using errcode = 'P0001'; end if;
  if invite.expires_at < now() then raise exception 'invite_expired' using errcode = 'P0001'; end if;

  for old_family in select family_id from public.family_members where user_id = me loop
    if exists (select 1 from public.family_members where family_id = old_family and user_id <> me) then
      delete from public.family_members where family_id = old_family and user_id = me;
    elsif exists (select 1 from public.family_profiles where family_id = old_family and profile_type = 'child')
       or exists (select 1 from public.chores where family_id = old_family) then
      raise exception 'already_in_family' using errcode = 'P0001';
    else
      delete from public.families where id = old_family;
    end if;
  end loop;

  insert into public.family_members (family_id, user_id, role, email) values (invite.family_id, me, 'member', auth.jwt() ->> 'email');
  update public.family_invites set accepted_by = me, accepted_at = now() where id = invite.id;
  return invite.family_id;
end;
$$;

-- Removes a member from the caller's family. Anyone can leave; the owner can't be removed.
create function public.remove_family_member(member uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  fam uuid := public.current_family_id();
begin
  if fam is null then raise exception 'This login is not in a family yet.' using errcode = '42501'; end if;
  if exists (select 1 from public.family_members where family_id = fam and user_id = member and role = 'owner') then
    raise exception 'owner_cannot_be_removed' using errcode = 'P0001';
  end if;
  delete from public.family_members where family_id = fam and user_id = member;
end;
$$;

-- Signed-out visitors may only look up an invite; everything else needs a login.
revoke all on public.families, public.family_members, public.family_invites from anon;
revoke truncate, trigger, references on public.families, public.family_members, public.family_invites from authenticated;
revoke execute on function public.my_family_ids(), public.is_family_member(uuid), public.current_family_id(), public.set_family_id(), public.ensure_family(),
  public.create_family_invite(), public.family_invite_details(text), public.accept_family_invite(text), public.remove_family_member(uuid) from public, anon;
grant execute on function public.my_family_ids(), public.is_family_member(uuid), public.current_family_id(), public.ensure_family(),
  public.create_family_invite(), public.family_invite_details(text), public.accept_family_invite(text), public.remove_family_member(uuid) to authenticated;
grant execute on function public.family_invite_details(text) to anon;
