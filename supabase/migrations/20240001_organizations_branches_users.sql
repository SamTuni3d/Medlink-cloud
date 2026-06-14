-- ============================================================
-- Migration 001: Core Tenant Tables
-- organizations, branches, users
-- Shared helper trigger functions used throughout migrations
-- ============================================================

-- ─── Shared trigger functions ─────────────────────────────────────────────────

-- Advances updated_seq using the sequence named in TG_ARGV[0].
-- Used by BEFORE INSERT OR UPDATE triggers on sync-tracked tables.
CREATE OR REPLACE FUNCTION fn_set_updated_seq()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_seq = nextval(TG_ARGV[0]);
  RETURN NEW;
END;
$$;

-- Sets updated_at to now() on every UPDATE.
CREATE OR REPLACE FUNCTION fn_update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─── organizations ─────────────────────────────────────────────────────────────

CREATE TABLE organizations (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text        NOT NULL,
  registration_number text        UNIQUE,
  country             text        NOT NULL,
  city                text        NOT NULL,
  currency_code       char(3)     NOT NULL DEFAULT 'GHS',
  subscription_tier   text        NOT NULL DEFAULT 'starter',
  is_active           boolean     NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ─── branches ─────────────────────────────────────────────────────────────────

CREATE TABLE branches (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  address         text,
  phone           text,
  is_active       boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_branches_organization_id ON branches(organization_id);

-- ─── users ────────────────────────────────────────────────────────────────────

CREATE TABLE users (
  id                uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id   uuid        NOT NULL REFERENCES organizations(id),
  default_branch_id uuid        REFERENCES branches(id) ON DELETE SET NULL,
  full_name         text        NOT NULL,
  email             text        NOT NULL UNIQUE,
  phone             text,
  is_active         boolean     NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_organization_id    ON users(organization_id);
CREATE INDEX idx_users_default_branch_id ON users(default_branch_id);

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ─── RLS helper (defined after users table) ───────────────────────────────────

-- Returns the organization_id of the current authenticated user.
-- SECURITY DEFINER so it bypasses RLS on the users table, preventing
-- infinite recursion when called inside a users RLS policy.
CREATE OR REPLACE FUNCTION get_user_organization_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT organization_id FROM users WHERE id = auth.uid()
$$;

-- ─── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches      ENABLE ROW LEVEL SECURITY;
ALTER TABLE users         ENABLE ROW LEVEL SECURITY;

-- organizations: users see and modify only their own organization
CREATE POLICY "tenant_select" ON organizations
  FOR SELECT USING (id = get_user_organization_id());

CREATE POLICY "tenant_update" ON organizations
  FOR UPDATE
  USING    (id = get_user_organization_id())
  WITH CHECK (id = get_user_organization_id());

-- branches: scoped to user's organization
CREATE POLICY "tenant_select" ON branches
  FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "tenant_insert" ON branches
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "tenant_update" ON branches
  FOR UPDATE
  USING    (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());

-- users: scoped to user's organization
CREATE POLICY "tenant_select" ON users
  FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "tenant_update" ON users
  FOR UPDATE
  USING    (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());

-- Note: INSERT into organizations and users is via service-role client only
-- (registration server action). No INSERT RLS policy means anon/authenticated
-- roles cannot insert — only service role bypasses RLS entirely.
