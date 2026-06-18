-- ============================================================
-- Migration 011: Purchase Orders
-- PO header + line items. Receiving a PO calls receiveBatch()
-- + recordStockMovement(receipt) — trigger handles current_stock.
-- ============================================================

CREATE TABLE purchase_orders (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id         uuid        NOT NULL REFERENCES branches(id)      ON DELETE CASCADE,
  supplier_id       uuid        REFERENCES suppliers(id) ON DELETE SET NULL,
  po_number         text        NOT NULL,
  status            text        NOT NULL DEFAULT 'draft'
                      CONSTRAINT po_status_check CHECK (
                        status IN ('draft','ordered','partial','received','cancelled')
                      ),
  notes             text,
  expected_date     date,
  ordered_at        timestamptz,
  received_at       timestamptz,
  created_by        uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, po_number)
);

CREATE INDEX idx_po_branch      ON purchase_orders(branch_id, created_at DESC);
CREATE INDEX idx_po_org         ON purchase_orders(organization_id);
CREATE INDEX idx_po_supplier    ON purchase_orders(supplier_id);
CREATE INDEX idx_po_status      ON purchase_orders(branch_id, status);

CREATE TABLE purchase_order_items (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid        NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  medication_id     uuid        NOT NULL REFERENCES medications_master(id) ON DELETE RESTRICT,
  quantity_ordered  integer     NOT NULL CHECK (quantity_ordered > 0),
  quantity_received integer     NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
  unit_cost         numeric(12,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  currency_code     char(3)     NOT NULL DEFAULT 'GHS',
  batch_number      text,
  expiry_date       date,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_poi_po         ON purchase_order_items(purchase_order_id);
CREATE INDEX idx_poi_medication ON purchase_order_items(medication_id);

ALTER TABLE purchase_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON purchase_orders
  FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "tenant_insert" ON purchase_orders
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id());
CREATE POLICY "tenant_update" ON purchase_orders
  FOR UPDATE USING (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "tenant_select" ON purchase_order_items
  FOR SELECT USING (
    purchase_order_id IN (
      SELECT id FROM purchase_orders WHERE organization_id = get_user_organization_id()
    )
  );
CREATE POLICY "tenant_insert" ON purchase_order_items
  FOR INSERT WITH CHECK (
    purchase_order_id IN (
      SELECT id FROM purchase_orders WHERE organization_id = get_user_organization_id()
    )
  );
CREATE POLICY "tenant_update" ON purchase_order_items
  FOR UPDATE USING (
    purchase_order_id IN (
      SELECT id FROM purchase_orders WHERE organization_id = get_user_organization_id()
    )
  );
