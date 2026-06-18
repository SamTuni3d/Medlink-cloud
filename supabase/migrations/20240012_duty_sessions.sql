-- ============================================================
-- Migration 012: Duty Sessions
-- Track when pharmacy staff clock in and out of shifts.
-- Used by the Users page to show who is currently on duty
-- and to attribute sales to specific staff members.
-- ============================================================

CREATE TABLE duty_sessions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id         uuid        NOT NULL REFERENCES branches(id)      ON DELETE CASCADE,
  user_id           uuid        NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
  clocked_in_at     timestamptz NOT NULL DEFAULT now(),
  clocked_out_at    timestamptz,
  clocked_in_by     uuid        REFERENCES users(id)                  ON DELETE SET NULL,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Efficiently find who is currently on duty at a branch
CREATE INDEX idx_duty_branch_active
  ON duty_sessions(branch_id, clocked_in_at DESC)
  WHERE clocked_out_at IS NULL;

-- History per user (for per-staff views)
CREATE INDEX idx_duty_user_time ON duty_sessions(user_id, clocked_in_at DESC);

-- History per branch (for roster audit)
CREATE INDEX idx_duty_branch_time ON duty_sessions(branch_id, clocked_in_at DESC);

-- Org-level index for RLS helper
CREATE INDEX idx_duty_org ON duty_sessions(organization_id);

-- Row Level Security
ALTER TABLE duty_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON duty_sessions
  FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "tenant_insert" ON duty_sessions
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "tenant_update" ON duty_sessions
  FOR UPDATE
  USING    (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());
