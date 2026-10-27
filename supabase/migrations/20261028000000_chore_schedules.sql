-- Chore schedules (due day, every other week, per-kid schedules) and random step splitting.
-- schedule: JSON text, see src/lib/choreSchedule.ts. Null = repeat by `frequency` as before.
-- random_mode: with random assignment on, 'chore' (one kid does it all), 'chore_and_subtasks'
--   (a random group of random_group_size kids splits the steps) or 'subtasks' (every picked kid, steps split).
alter table public.chores
  add column if not exists schedule text,
  add column if not exists random_mode text not null default 'chore',
  add column if not exists random_group_size integer;

alter table public.chores drop constraint if exists chores_random_mode_check;
alter table public.chores add constraint chores_random_mode_check check (random_mode in ('chore', 'chore_and_subtasks', 'subtasks'));

notify pgrst, 'reload schema';
