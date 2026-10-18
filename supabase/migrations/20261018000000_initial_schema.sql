-- Schema exported from Overskill on 2026-10-18 (app "Chorerewards"), data rows removed.
-- The data export is kept outside this public repo.
-- The RLS policies still use Overskill's organization model; they get rewritten when auth moves to Supabase.

-- Ensure you're connected to your Supabase instance before running this script
-- Required extensions:
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- Create application schema
CREATE SCHEMA IF NOT EXISTS app_22072;

-- Set search path
SET search_path TO app_22072, public;

-- Grant usage to authenticated users
GRANT USAGE ON SCHEMA app_22072 TO authenticated;
GRANT CREATE ON SCHEMA app_22072 TO authenticated;


-- Table: family_profiles
CREATE TABLE IF NOT EXISTS family_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  profile_type TEXT NOT NULL,
  theme_key TEXT NOT NULL DEFAULT 'sunset',
  pin_hash TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  overskill_user_id TEXT,
  organization_id UUID NOT NULL,
  app_id UUID NOT NULL DEFAULT '22072'::uuid,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID,
  updated_by UUID
);

-- Enable RLS
ALTER TABLE family_profiles ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON TABLE family_profiles TO authenticated;


-- Table: goals
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prize TEXT,
  reward_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  frequency TEXT NOT NULL,
  target_profile_id TEXT NOT NULL,
  target_count NUMERIC NOT NULL DEFAULT 1,
  progress NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  overskill_user_id TEXT,
  organization_id UUID NOT NULL,
  app_id UUID NOT NULL DEFAULT '22072'::uuid,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID,
  updated_by UUID
);

-- Enable RLS
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON TABLE goals TO authenticated;


-- Table: chores
CREATE TABLE IF NOT EXISTS chores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requires_verification BOOLEAN NOT NULL DEFAULT FALSE,
  title TEXT NOT NULL,
  frequency TEXT NOT NULL,
  target_profile_id TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  assigned_profile_ids TEXT,
  subtasks TEXT,
  reward TEXT,
  reward_points NUMERIC NOT NULL DEFAULT 0,
  time_limit_minutes NUMERIC,
  random_assignment_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  assignment_change_frequency TEXT NOT NULL DEFAULT 'weekly',
  assignment_rotation_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  reward_id TEXT,
  overskill_user_id TEXT,
  organization_id UUID NOT NULL,
  app_id UUID NOT NULL DEFAULT '22072'::uuid,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID,
  updated_by UUID
);

-- Enable RLS
ALTER TABLE chores ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON TABLE chores TO authenticated;


-- Table: chore_completions
CREATE TABLE IF NOT EXISTS chore_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_key TEXT NOT NULL,
  completed_task_ids TEXT,
  status TEXT DEFAULT 'in_progress',
  started_at TIMESTAMP WITH TIME ZONE,
  deadline_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  verified_at TIMESTAMP WITH TIME ZONE,
  chore_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  reward_points_snapshot NUMERIC NOT NULL DEFAULT 0,
  review_status TEXT DEFAULT 'unreviewed',
  rejection_reason TEXT,
  parent_feedback TEXT,
  overskill_user_id TEXT,
  organization_id UUID NOT NULL,
  app_id UUID NOT NULL DEFAULT '22072'::uuid,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID,
  updated_by UUID
);

-- Enable RLS
ALTER TABLE chore_completions ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON TABLE chore_completions TO authenticated;


-- Table: family_rewards
CREATE TABLE IF NOT EXISTS family_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_profile_id TEXT,
  points_required NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  title TEXT NOT NULL,
  description TEXT,
  reward_type TEXT NOT NULL DEFAULT 'participation',
  overskill_user_id TEXT,
  organization_id UUID NOT NULL,
  app_id UUID NOT NULL DEFAULT '22072'::uuid,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID,
  updated_by UUID
);

-- Enable RLS
ALTER TABLE family_rewards ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON TABLE family_rewards TO authenticated;


-- Table: household_members
CREATE TABLE IF NOT EXISTS household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id TEXT NOT NULL,
  user_id TEXT,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'parent',
  status TEXT NOT NULL DEFAULT 'invited',
  can_view_chores BOOLEAN DEFAULT TRUE,
  can_edit_chores BOOLEAN DEFAULT FALSE,
  can_view_rewards BOOLEAN DEFAULT TRUE,
  can_edit_rewards BOOLEAN DEFAULT FALSE,
  can_manage_profiles BOOLEAN DEFAULT FALSE,
  token_hash TEXT,
  invite_expires_at TIMESTAMP WITH TIME ZONE,
  invited_by TEXT,
  team_id TEXT,
  organization_id UUID NOT NULL,
  app_id UUID NOT NULL DEFAULT '22072'::uuid,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID,
  updated_by UUID
);

-- Enable RLS
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON TABLE household_members TO authenticated;


-- Table: households
CREATE TABLE IF NOT EXISTS households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  team_id TEXT,
  organization_id UUID NOT NULL,
  app_id UUID NOT NULL DEFAULT '22072'::uuid,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID,
  updated_by UUID
);

-- Enable RLS
ALTER TABLE households ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON TABLE households TO authenticated;


-- Helper function to check organization membership
CREATE OR REPLACE FUNCTION check_organization_access(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- This checks if the current user belongs to the organization
  -- In production, this would check against your user management system
  RETURN auth.uid() IS NOT NULL AND org_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RLS Policies for family_profiles

-- Policy: Users can view their organization's data
CREATE POLICY "family_profiles_select_policy" ON family_profiles
  FOR SELECT
  TO authenticated
  USING (check_organization_access(organization_id));

-- Policy: Users can insert data for their organization
CREATE POLICY "family_profiles_insert_policy" ON family_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    check_organization_access(organization_id) AND
    created_by = auth.uid()
  );

-- Policy: Users can update their organization's data
CREATE POLICY "family_profiles_update_policy" ON family_profiles
  FOR UPDATE
  TO authenticated
  USING (check_organization_access(organization_id))
  WITH CHECK (
    check_organization_access(organization_id) AND
    updated_by = auth.uid()
  );

-- Policy: Users can delete their organization's data
CREATE POLICY "family_profiles_delete_policy" ON family_profiles
  FOR DELETE
  TO authenticated
  USING (check_organization_access(organization_id));


-- RLS Policies for goals

-- Policy: Users can view their organization's data
CREATE POLICY "goals_select_policy" ON goals
  FOR SELECT
  TO authenticated
  USING (check_organization_access(organization_id));

-- Policy: Users can insert data for their organization
CREATE POLICY "goals_insert_policy" ON goals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    check_organization_access(organization_id) AND
    created_by = auth.uid()
  );

-- Policy: Users can update their organization's data
CREATE POLICY "goals_update_policy" ON goals
  FOR UPDATE
  TO authenticated
  USING (check_organization_access(organization_id))
  WITH CHECK (
    check_organization_access(organization_id) AND
    updated_by = auth.uid()
  );

-- Policy: Users can delete their organization's data
CREATE POLICY "goals_delete_policy" ON goals
  FOR DELETE
  TO authenticated
  USING (check_organization_access(organization_id));


-- RLS Policies for chores

-- Policy: Users can view their organization's data
CREATE POLICY "chores_select_policy" ON chores
  FOR SELECT
  TO authenticated
  USING (check_organization_access(organization_id));

-- Policy: Users can insert data for their organization
CREATE POLICY "chores_insert_policy" ON chores
  FOR INSERT
  TO authenticated
  WITH CHECK (
    check_organization_access(organization_id) AND
    created_by = auth.uid()
  );

-- Policy: Users can update their organization's data
CREATE POLICY "chores_update_policy" ON chores
  FOR UPDATE
  TO authenticated
  USING (check_organization_access(organization_id))
  WITH CHECK (
    check_organization_access(organization_id) AND
    updated_by = auth.uid()
  );

-- Policy: Users can delete their organization's data
CREATE POLICY "chores_delete_policy" ON chores
  FOR DELETE
  TO authenticated
  USING (check_organization_access(organization_id));


-- RLS Policies for chore_completions

-- Policy: Users can view their organization's data
CREATE POLICY "chore_completions_select_policy" ON chore_completions
  FOR SELECT
  TO authenticated
  USING (check_organization_access(organization_id));

-- Policy: Users can insert data for their organization
CREATE POLICY "chore_completions_insert_policy" ON chore_completions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    check_organization_access(organization_id) AND
    created_by = auth.uid()
  );

-- Policy: Users can update their organization's data
CREATE POLICY "chore_completions_update_policy" ON chore_completions
  FOR UPDATE
  TO authenticated
  USING (check_organization_access(organization_id))
  WITH CHECK (
    check_organization_access(organization_id) AND
    updated_by = auth.uid()
  );

-- Policy: Users can delete their organization's data
CREATE POLICY "chore_completions_delete_policy" ON chore_completions
  FOR DELETE
  TO authenticated
  USING (check_organization_access(organization_id));


-- RLS Policies for family_rewards

-- Policy: Users can view their organization's data
CREATE POLICY "family_rewards_select_policy" ON family_rewards
  FOR SELECT
  TO authenticated
  USING (check_organization_access(organization_id));

-- Policy: Users can insert data for their organization
CREATE POLICY "family_rewards_insert_policy" ON family_rewards
  FOR INSERT
  TO authenticated
  WITH CHECK (
    check_organization_access(organization_id) AND
    created_by = auth.uid()
  );

-- Policy: Users can update their organization's data
CREATE POLICY "family_rewards_update_policy" ON family_rewards
  FOR UPDATE
  TO authenticated
  USING (check_organization_access(organization_id))
  WITH CHECK (
    check_organization_access(organization_id) AND
    updated_by = auth.uid()
  );

-- Policy: Users can delete their organization's data
CREATE POLICY "family_rewards_delete_policy" ON family_rewards
  FOR DELETE
  TO authenticated
  USING (check_organization_access(organization_id));


-- RLS Policies for household_members

-- Policy: Users can view their organization's data
CREATE POLICY "household_members_select_policy" ON household_members
  FOR SELECT
  TO authenticated
  USING (check_organization_access(organization_id));

-- Policy: Users can insert data for their organization
CREATE POLICY "household_members_insert_policy" ON household_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    check_organization_access(organization_id) AND
    created_by = auth.uid()
  );

-- Policy: Users can update their organization's data
CREATE POLICY "household_members_update_policy" ON household_members
  FOR UPDATE
  TO authenticated
  USING (check_organization_access(organization_id))
  WITH CHECK (
    check_organization_access(organization_id) AND
    updated_by = auth.uid()
  );

-- Policy: Users can delete their organization's data
CREATE POLICY "household_members_delete_policy" ON household_members
  FOR DELETE
  TO authenticated
  USING (check_organization_access(organization_id));


-- RLS Policies for households

-- Policy: Users can view their organization's data
CREATE POLICY "households_select_policy" ON households
  FOR SELECT
  TO authenticated
  USING (check_organization_access(organization_id));

-- Policy: Users can insert data for their organization
CREATE POLICY "households_insert_policy" ON households
  FOR INSERT
  TO authenticated
  WITH CHECK (
    check_organization_access(organization_id) AND
    created_by = auth.uid()
  );

-- Policy: Users can update their organization's data
CREATE POLICY "households_update_policy" ON households
  FOR UPDATE
  TO authenticated
  USING (check_organization_access(organization_id))
  WITH CHECK (
    check_organization_access(organization_id) AND
    updated_by = auth.uid()
  );

-- Policy: Users can delete their organization's data
CREATE POLICY "households_delete_policy" ON households
  FOR DELETE
  TO authenticated
  USING (check_organization_access(organization_id));


-- ========================================
-- NOTE ON COLUMNS: the CREATE TABLE statements above declare
-- organization_id, app_id, created_by, updated_by, which no live row carries (they are
-- placeholders from an earlier storage backend). The INSERTs above list
-- only columns that exist in the exported rows, so relax or default
-- those columns before importing.

-- Indexes for family_profiles
CREATE INDEX IF NOT EXISTS idx_family_profiles_org_id ON family_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_family_profiles_created_at ON family_profiles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_family_profiles_updated_at ON family_profiles(updated_at DESC);


-- Indexes for goals
CREATE INDEX IF NOT EXISTS idx_goals_org_id ON goals(organization_id);
CREATE INDEX IF NOT EXISTS idx_goals_created_at ON goals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_goals_updated_at ON goals(updated_at DESC);


-- Indexes for chores
CREATE INDEX IF NOT EXISTS idx_chores_org_id ON chores(organization_id);
CREATE INDEX IF NOT EXISTS idx_chores_created_at ON chores(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chores_updated_at ON chores(updated_at DESC);


-- Indexes for chore_completions
CREATE INDEX IF NOT EXISTS idx_chore_completions_org_id ON chore_completions(organization_id);
CREATE INDEX IF NOT EXISTS idx_chore_completions_created_at ON chore_completions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chore_completions_updated_at ON chore_completions(updated_at DESC);


-- Indexes for family_rewards
CREATE INDEX IF NOT EXISTS idx_family_rewards_org_id ON family_rewards(organization_id);
CREATE INDEX IF NOT EXISTS idx_family_rewards_created_at ON family_rewards(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_family_rewards_updated_at ON family_rewards(updated_at DESC);


-- Indexes for household_members
CREATE INDEX IF NOT EXISTS idx_household_members_org_id ON household_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_household_members_created_at ON household_members(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_household_members_updated_at ON household_members(updated_at DESC);


-- Indexes for households
CREATE INDEX IF NOT EXISTS idx_households_org_id ON households(organization_id);
CREATE INDEX IF NOT EXISTS idx_households_created_at ON households(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_households_updated_at ON households(updated_at DESC);


-- Audit system for compliance and transparency
-- This is a key differentiator from Base44 and other competitors

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  changed_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index for efficient audit queries
CREATE INDEX idx_audit_log_table_record ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_org_created ON audit_log(organization_id, created_at DESC);
CREATE INDEX idx_audit_log_user_created ON audit_log(user_id, created_at DESC);

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (table_name, record_id, action, organization_id, user_id, changed_data)
    VALUES (TG_TABLE_NAME, NEW.id, TG_OP, NEW.organization_id, NEW.created_by, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (table_name, record_id, action, organization_id, user_id, changed_data)
    VALUES (TG_TABLE_NAME, NEW.id, TG_OP, NEW.organization_id, NEW.updated_by, 
            jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW)));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (table_name, record_id, action, organization_id, user_id, changed_data)
    VALUES (TG_TABLE_NAME, OLD.id, TG_OP, OLD.organization_id, auth.uid(), to_jsonb(OLD));
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ========================================
