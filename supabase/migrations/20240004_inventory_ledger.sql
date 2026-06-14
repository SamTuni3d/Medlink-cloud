-- ============================================================
-- Migration 004: Inventory Ledger
-- inventory, inventory_batches, stock_movements
-- Trigger: every INSERT on stock_movements updates inventory.current_stock
-- Rule 3: inventory.current_stock is ALWAYS derived from stock_movements
-- ============================================================

-- ─── Sequences for sync cursors ───────────────────────────────────────────────

CREATE SEQUENCE seq_inventory_updated        START 1 INCREMENT 1;
CREATE SEQUENCE seq_inventory_batches_updated START 1 INCREMENT 1;

-- ─── inventory ────────────────────────────────────────────────────────────────
-- current_stock is maintained exclusively by trg_stock_movement_update_inventory.
-- Never UPDATE inventory.current_stock directly from application code.

CREATE TABLE inventory (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id           uuid        NOT NULL REFERENCES branches(id)  ON DELETE CASCADE,
  medication_id       uuid        NOT NULL REFERENCES medications_master(id) ON DELETE RESTRICT,
  current_stock       integer     NOT NULL DEFAULT 0,
  reserved_stock      integer     NOT NULL DEFAULT 0 CHECK (reserved_stock >= 0),
  last_reconciled_at  timestamptz,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  updated_seq         bigint      NOT NULL DEFAULT nextval('seq_inventory_updated'),
  UNIQUE (branch_id, medication_id)
);

CREATE INDEX idx_inventory_organization_id ON inventory(organization_id);
CREATE INDEX idx_inventory_branch_id       ON inventory(branch_id);
CREATE INDEX idx_inventory_medication_id   ON inventory(medication_id);
-- Sync pull index
CREATE INDEX idx_inventory_branch_seq      ON inventory(branch_id, updated_seq);

CREATE TRIGGER trg_inventory_updated_at
BEFORE UPDATE ON inventory
FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- updated_seq advances on every change so devices know to re-pull
CREATE TRIGGER trg_inventory_updated_seq
BEFORE INSERT OR UPDATE ON inventory
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_seq('seq_inventory_updated');

-- ─── inventory_batches ────────────────────────────────────────────────────────
-- Stores individual stock batches. expiry_date NULL = non-expiring item.
-- FEFO: sort by expiry_date ASC NULLS LAST, then received_at ASC.

CREATE TABLE inventory_batches (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id           uuid        NOT NULL REFERENCES branches(id)  ON DELETE CASCADE,
  medication_id       uuid        NOT NULL REFERENCES medications_master(id) ON DELETE RESTRICT,
  supplier_id         uuid        REFERENCES suppliers(id) ON DELETE SET NULL,
  batch_number        text        NOT NULL,
  expiry_date         date,         -- NULL = non-expiring
  quantity_received   integer     NOT NULL CHECK (quantity_received > 0),
  quantity_remaining  integer     NOT NULL CHECK (quantity_remaining >= 0),
  cost_price          numeric(12,2) NOT NULL CHECK (cost_price >= 0),
  currency_code       char(3)     NOT NULL DEFAULT 'GHS',
  received_at         timestamptz NOT NULL DEFAULT now(),
  created_by          uuid        REFERENCES users(id) ON DELETE SET NULL,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  updated_seq         bigint      NOT NULL DEFAULT nextval('seq_inventory_batches_updated')
);

-- FEFO query index: branch + medication, sorted by expiry_date (nulls last = non-expiring used last)
CREATE INDEX idx_batches_fefo
  ON inventory_batches(branch_id, medication_id, expiry_date ASC NULLS LAST, received_at ASC)
  WHERE quantity_remaining > 0;

CREATE INDEX idx_batches_organization_id ON inventory_batches(organization_id);
-- Sync pull index
CREATE INDEX idx_batches_branch_seq      ON inventory_batches(branch_id, updated_seq);

CREATE TRIGGER trg_batches_updated_at
BEFORE UPDATE ON inventory_batches
FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_batches_updated_seq
BEFORE INSERT OR UPDATE ON inventory_batches
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_seq('seq_inventory_batches_updated');

-- ─── stock_movements ──────────────────────────────────────────────────────────
-- Immutable ledger. Only INSERT is allowed; no UPDATE or DELETE.
-- Every INSERT triggers an update to inventory.current_stock.

CREATE TABLE stock_movements (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id       uuid        NOT NULL REFERENCES branches(id)  ON DELETE CASCADE,
  medication_id   uuid        NOT NULL REFERENCES medications_master(id) ON DELETE RESTRICT,
  batch_id        uuid        REFERENCES inventory_batches(id) ON DELETE RESTRICT,
  movement_type   text        NOT NULL
                    CONSTRAINT movement_type_check CHECK (
                      movement_type IN (
                        'receipt','sale','adjustment',
                        'transfer_in','transfer_out',
                        'expiry_write_off','opening_stock'
                      )
                    ),
  -- positive = stock in, negative = stock out
  delta           integer     NOT NULL,
  reference_id    uuid,         -- sale.id or purchase_order.id
  notes           text,
  performed_by    uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_movements_branch_medication
  ON stock_movements(branch_id, medication_id, created_at DESC);
CREATE INDEX idx_movements_organization_id
  ON stock_movements(organization_id);
CREATE INDEX idx_movements_reference_id
  ON stock_movements(reference_id)
  WHERE reference_id IS NOT NULL;

-- ─── Trigger: update inventory.current_stock on every stock_movement INSERT ───

CREATE OR REPLACE FUNCTION fn_update_inventory_on_movement()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO inventory (
    organization_id, branch_id, medication_id,
    current_stock, updated_at
  )
  VALUES (
    NEW.organization_id, NEW.branch_id, NEW.medication_id,
    NEW.delta, now()
  )
  ON CONFLICT (branch_id, medication_id)
  DO UPDATE SET
    current_stock = inventory.current_stock + EXCLUDED.current_stock,
    updated_at    = now();

  -- Also decrement quantity_remaining on the batch if batch_id is set
  IF NEW.batch_id IS NOT NULL AND NEW.delta < 0 THEN
    UPDATE inventory_batches
    SET quantity_remaining = quantity_remaining + NEW.delta  -- delta is negative
    WHERE id = NEW.batch_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stock_movement_update_inventory
AFTER INSERT ON stock_movements
FOR EACH ROW EXECUTE FUNCTION fn_update_inventory_on_movement();

-- ─── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE inventory         ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements   ENABLE ROW LEVEL SECURITY;

-- inventory
CREATE POLICY "tenant_select" ON inventory
  FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "tenant_insert" ON inventory
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "tenant_update" ON inventory
  FOR UPDATE
  USING    (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());

-- inventory_batches
CREATE POLICY "tenant_select" ON inventory_batches
  FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "tenant_insert" ON inventory_batches
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "tenant_update" ON inventory_batches
  FOR UPDATE
  USING    (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());

-- stock_movements: INSERT and SELECT only (immutable ledger)
CREATE POLICY "tenant_select" ON stock_movements
  FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "tenant_insert" ON stock_movements
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id());
-- No UPDATE or DELETE policies — stock_movements rows cannot be modified.
