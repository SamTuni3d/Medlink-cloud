-- ============================================================
-- Migration 005: Sales
-- sales, sale_items
-- Amendment C: UNIQUE(device_id, branch_id, sale_number) for offline safety
-- ============================================================

-- ─── sales ────────────────────────────────────────────────────────────────────

CREATE TABLE sales (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id           uuid          NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  -- device_id: client-generated UUID, unique per device
  device_id           uuid          NOT NULL,
  cashier_id          uuid          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  -- sale_number: device-scoped e.g. 'DEV-A1B2-001' — safe for offline generation
  sale_number         text          NOT NULL,
  -- branch_sale_number: sequential within branch, assigned server-side on sync
  branch_sale_number  integer,
  status              text          NOT NULL DEFAULT 'completed'
                        CONSTRAINT sales_status_check CHECK (
                          status IN ('pending','completed','voided')
                        ),
  subtotal            numeric(12,2) NOT NULL CHECK (subtotal >= 0),
  discount_amount     numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  tax_amount          numeric(12,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount        numeric(12,2) NOT NULL CHECK (total_amount >= 0),
  currency_code       char(3)       NOT NULL,
  payment_method      text          NOT NULL
                        CONSTRAINT sales_payment_check CHECK (
                          payment_method IN ('cash','card','mobile_money','credit')
                        ),
  amount_tendered     numeric(12,2),
  change_given        numeric(12,2),
  prescription_number text,
  customer_name       text,
  -- synced_at NULL means the sale was created offline and not yet confirmed server-side
  synced_at           timestamptz,
  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now(),
  -- Prevents duplicate sync pushes: same device cannot push the same sale number twice
  CONSTRAINT sales_device_unique UNIQUE (device_id, branch_id, sale_number)
);

CREATE INDEX idx_sales_organization_id ON sales(organization_id);
CREATE INDEX idx_sales_branch_created  ON sales(branch_id, created_at DESC);
CREATE INDEX idx_sales_cashier_created ON sales(cashier_id, created_at DESC);
CREATE INDEX idx_sales_pending_sync    ON sales(branch_id, synced_at)
  WHERE synced_at IS NULL;
CREATE INDEX idx_sales_branch_number   ON sales(branch_id, branch_sale_number)
  WHERE branch_sale_number IS NOT NULL;

CREATE TRIGGER trg_sales_updated_at
BEFORE UPDATE ON sales
FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ─── sale_items ───────────────────────────────────────────────────────────────

CREATE TABLE sale_items (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sale_id         uuid          NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  medication_id   uuid          NOT NULL REFERENCES medications_master(id) ON DELETE RESTRICT,
  -- batch_id: FEFO-selected batch; nullable (some items may not have batch tracking)
  batch_id        uuid          REFERENCES inventory_batches(id) ON DELETE RESTRICT,
  quantity        integer       NOT NULL CHECK (quantity > 0),
  unit_price      numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  discount_percent numeric(5,2) NOT NULL DEFAULT 0
                    CHECK (discount_percent >= 0 AND discount_percent <= 100),
  line_total      numeric(12,2) NOT NULL CHECK (line_total >= 0),
  currency_code   char(3)       NOT NULL
);

CREATE INDEX idx_sale_items_sale_id        ON sale_items(sale_id);
CREATE INDEX idx_sale_items_medication_id  ON sale_items(medication_id);
CREATE INDEX idx_sale_items_organization_id ON sale_items(organization_id);

-- ─── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE sales      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

-- sales: INSERT allowed (offline POS sync push); SELECT/UPDATE scoped to org
CREATE POLICY "tenant_select" ON sales
  FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "tenant_insert" ON sales
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "tenant_update" ON sales
  FOR UPDATE
  USING    (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());

-- sale_items
CREATE POLICY "tenant_select" ON sale_items
  FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "tenant_insert" ON sale_items
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id());
