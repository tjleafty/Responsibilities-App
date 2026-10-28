-- Chore difficulty. Points scale with the family's multipliers (families.settings.points.multipliers).
alter table public.chores add column if not exists difficulty text check (difficulty in ('easy', 'medium', 'hard'));
