-- ============================================================
-- Migration 010: Stock Takes
-- Audit header grouping a set of stock_movements(adjustment)
-- from a single physical count session.
-- ============================================================

CREATE TABLE stock_takes (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid        NOT NULL REFERENCES organizations(id)  ON DELETE CASCADE,
  branch_id         uuid        NOT NULL REFERENCES branches(id)       ON DELETE CASCADE,
  performed_by      uuid        REFERENCES users(id) ON DELETE SET NULL,
  notes             text,
  item_count        integer     NOT NULL DEFAULT 0,
  discrepancy_count integer     NOT NULL DEFAULT 0,
  completed_at      timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_takes_branch ON stock_takes(branch_id, completed_at DESC);
CREATE INDEX idx_stock_takes_org    ON stock_takes(organization_id);

ALTER TABLE stock_takes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON stock_takes
  FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "tenant_insert" ON stock_takes
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id());
