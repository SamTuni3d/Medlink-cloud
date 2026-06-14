-- ============================================================
-- Migration 002: RBAC Tables
-- roles, permissions, role_permissions, user_roles
-- Seed data for all 7 roles and full permission set
-- ============================================================

-- ─── roles ────────────────────────────────────────────────────────────────────

CREATE TABLE roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE
                CONSTRAINT roles_name_check CHECK (
                  name IN ('super_admin','org_admin','branch_manager',
                           'pharmacist','cashier','inventory_manager','auditor')
                ),
  description text
);

-- ─── permissions ──────────────────────────────────────────────────────────────

CREATE TABLE permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,
  description text
);

-- ─── role_permissions ─────────────────────────────────────────────────────────

CREATE TABLE role_permissions (
  role_id       uuid NOT NULL REFERENCES roles(id)       ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- ─── user_roles ───────────────────────────────────────────────────────────────

CREATE TABLE user_roles (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id         uuid        NOT NULL REFERENCES roles(id),
  -- NULL = org-wide role; non-null = branch-scoped role
  branch_id       uuid        REFERENCES branches(id) ON DELETE CASCADE,
  granted_by      uuid        NOT NULL REFERENCES users(id),
  granted_at      timestamptz NOT NULL DEFAULT now(),
  -- NULLS NOT DISTINCT: treats two NULL branch_ids as equal (requires Postgres 15+)
  UNIQUE NULLS NOT DISTINCT (user_id, role_id, branch_id)
);

CREATE INDEX idx_user_roles_organization_id ON user_roles(organization_id);
CREATE INDEX idx_user_roles_user_id         ON user_roles(user_id);
CREATE INDEX idx_user_roles_branch_id       ON user_roles(branch_id);

-- ─── Seed: roles ──────────────────────────────────────────────────────────────

INSERT INTO roles (name, description) VALUES
  ('super_admin',       'System-level administrator'),
  ('org_admin',         'Organization owner / administrator'),
  ('branch_manager',    'Branch-level manager'),
  ('pharmacist',        'Licensed pharmacist'),
  ('cashier',           'POS cashier and sales staff'),
  ('inventory_manager', 'Inventory and stock management'),
  ('auditor',           'Read-only auditor')
ON CONFLICT (name) DO NOTHING;

-- ─── Seed: permissions ────────────────────────────────────────────────────────

INSERT INTO permissions (code, description) VALUES
  -- Sales
  ('sales:create',       'Create a new sale (POS)'),
  ('sales:view_own',     'View own sales history'),
  ('sales:view_branch',  'View all sales in assigned branch'),
  ('sales:view_all',     'View all sales across the organisation'),
  ('sales:void',         'Void a completed sale'),
  -- Inventory
  ('inventory:view',     'View inventory levels and batch list'),
  ('inventory:receive',  'Receive new stock (create receipt movement)'),
  ('inventory:adjust',   'Create a stock adjustment'),
  ('inventory:transfer', 'Transfer stock between branches'),
  -- Medications
  ('medications:view',   'View medication catalogue'),
  ('medications:create', 'Add a new medication to the catalogue'),
  ('medications:edit',   'Edit medication details and pricing'),
  -- Reports
  ('reports:branch',     'View branch-level sales and stock reports'),
  ('reports:org',        'View organisation-wide reports'),
  -- Users
  ('users:view',         'View the staff directory'),
  ('users:manage',       'Create and manage staff accounts'),
  ('users:roles',        'Assign and revoke roles for staff'),
  -- Audit
  ('audit:view',         'View the audit log'),
  -- Settings
  ('settings:branch',    'Edit branch name, address, contact details'),
  ('settings:org',       'Edit organisation settings and subscription')
ON CONFLICT (code) DO NOTHING;

-- ─── Seed: role → permission mappings ────────────────────────────────────────

-- org_admin gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'org_admin'
ON CONFLICT DO NOTHING;

-- branch_manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'branch_manager'
  AND p.code IN (
    'sales:create','sales:view_branch','sales:void',
    'inventory:view','inventory:receive','inventory:adjust','inventory:transfer',
    'medications:view',
    'reports:branch',
    'users:view','users:manage',
    'settings:branch'
  )
ON CONFLICT DO NOTHING;

-- pharmacist
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'pharmacist'
  AND p.code IN (
    'sales:create','sales:view_branch',
    'inventory:view','inventory:adjust',
    'medications:view'
  )
ON CONFLICT DO NOTHING;

-- cashier
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'cashier'
  AND p.code IN ('sales:create','sales:view_own','medications:view','inventory:view')
ON CONFLICT DO NOTHING;

-- inventory_manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'inventory_manager'
  AND p.code IN (
    'inventory:view','inventory:receive','inventory:adjust','inventory:transfer',
    'medications:view','medications:create','medications:edit',
    'reports:branch'
  )
ON CONFLICT DO NOTHING;

-- auditor (read-only)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'auditor'
  AND p.code IN (
    'sales:view_all','inventory:view','medications:view',
    'reports:org','users:view','audit:view'
  )
ON CONFLICT DO NOTHING;

-- ─── Row Level Security ────────────────────────────────────────────────────────

-- roles and permissions are system tables — any authenticated user can read them
ALTER TABLE roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read" ON roles
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_read" ON permissions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_read" ON role_permissions
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- user_roles: scoped to organization
CREATE POLICY "tenant_select" ON user_roles
  FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "tenant_insert" ON user_roles
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "tenant_delete" ON user_roles
  FOR DELETE USING (organization_id = get_user_organization_id());
