-- Chores can take turns in a set order instead of at random.
-- turn_order is JSON {"ids": [kid profile ids in order], "start": "YYYY-MM-DD"}:
-- the first kid is up in the period containing start, then turns go down the list and wrap around.
-- Null means turns are picked at random (the existing behaviour).
alter table public.chores add column if not exists turn_order text;

notify pgrst, 'reload schema';
