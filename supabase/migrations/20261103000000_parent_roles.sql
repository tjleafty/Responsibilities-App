-- Grown-up profiles can say whether they're Mom or Dad.
-- No uniqueness rule, so a family can have two moms or two dads.
-- Null means the profile didn't pick one (a kid, or a grown-up like a grandparent or sitter).
alter table public.family_profiles add column if not exists parent_role text;

alter table public.family_profiles drop constraint if exists family_profiles_parent_role_check;
alter table public.family_profiles add constraint family_profiles_parent_role_check
  check (parent_role is null or (parent_role in ('mom', 'dad') and profile_type = 'parent'));

notify pgrst, 'reload schema';
