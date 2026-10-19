-- Signed-out visitors get nothing, and signed-in users keep only row-level access (RLS still applies).
revoke all on public.family_profiles, public.goals, public.chores, public.chore_completions, public.family_rewards from anon;
revoke truncate, trigger, references on public.family_profiles, public.goals, public.chores, public.chore_completions, public.family_rewards from authenticated;
