-- ============================================================
-- Migration 006: Audit, Sync, Notifications
-- audit_logs  — append-only, no UPDATE/DELETE
-- sync_cursors — per-device, per-table sync state
-- notifications — system-generated alerts
-- ============================================================

-- ─── audit_logs ───────────────────────────────────────────────────────────────
-- Append-only. No UPDATE or DELETE RLS policies.
-- actor_id is nullable for system-generated entries (cron jobs, triggers).

CREATE TABLE audit_logs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id       uuid        REFERENCES branches(id) ON DELETE SET NULL,
  actor_id        uuid        REFERENCES users(id)   ON DELETE SET NULL,
  action          text        NOT NULL,
  table_name      text        NOT NULL,
  record_id       uuid,
  old_value       jsonb,
  new_value       jsonb,
  ip_address      inet,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_org_created   ON audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_audit_table_record  ON audit_logs(table_name, record_id)
  WHERE record_id IS NOT NULL;

-- ─── sync_cursors ─────────────────────────────────────────────────────────────
-- Tracks the last-seen updated_seq per device per table.
-- The POS reads and writes this to know what to pull next.

CREATE TABLE sync_cursors (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id       uuid        NOT NULL,
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id       uuid        NOT NULL REFERENCES branches(id)  ON DELETE CASCADE,
  table_name      text        NOT NULL,
  last_cursor     bigint      NOT NULL DEFAULT 0,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (device_id, table_name)
);

CREATE INDEX idx_sync_cursors_org ON sync_cursors(organization_id);

CREATE TRIGGER trg_sync_cursors_updated_at
BEFORE UPDATE ON sync_cursors
FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ─── notifications ────────────────────────────────────────────────────────────

CREATE TABLE notifications (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id       uuid        REFERENCES branches(id) ON DELETE SET NULL,
  type            text        NOT NULL
                    CONSTRAINT notifications_type_check CHECK (
                      type IN (
                        'expiry_warning','reorder_alert',
                        'reconciliation_discrepancy','system'
                      )
                    ),
  severity        text        NOT NULL
                    CONSTRAINT notifications_severity_check CHECK (
                      severity IN ('info','warning','critical')
                    ),
  title           text        NOT NULL,
  body            text        NOT NULL,
  related_table   text,
  related_id      uuid,
  is_read         boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_org_unread
  ON notifications(organization_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_related
  ON notifications(related_table, related_id)
  WHERE related_table IS NOT NULL;

-- ─── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE audit_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_cursors  ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- audit_logs: INSERT and SELECT only (append-only)
CREATE POLICY "tenant_select" ON audit_logs
  FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "tenant_insert" ON audit_logs
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id());
-- No UPDATE or DELETE policies.

-- sync_cursors: each device manages its own cursors
CREATE POLICY "tenant_select" ON sync_cursors
  FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "tenant_insert" ON sync_cursors
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "tenant_update" ON sync_cursors
  FOR UPDATE
  USING    (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());

-- notifications: read and mark as read
CREATE POLICY "tenant_select" ON notifications
  FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "tenant_insert" ON notifications
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "tenant_update" ON notifications
  FOR UPDATE
  USING    (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());
