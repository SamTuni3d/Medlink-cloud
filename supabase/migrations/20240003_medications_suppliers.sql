-- ============================================================
-- Migration 003: Product Catalogue
-- medications_master, suppliers
-- Full-text search index, updated_seq for sync
-- ============================================================

-- ─── Sequences for sync cursors ───────────────────────────────────────────────

CREATE SEQUENCE seq_medications_updated START 1 INCREMENT 1;
CREATE SEQUENCE seq_suppliers_updated   START 1 INCREMENT 1;

-- ─── suppliers ────────────────────────────────────────────────────────────────

CREATE TABLE suppliers (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  contact_name    text,
  phone           text,
  email           text,
  address         text,
  is_active       boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_seq     bigint      NOT NULL DEFAULT nextval('seq_suppliers_updated')
);

CREATE INDEX idx_suppliers_organization_id ON suppliers(organization_id);
CREATE INDEX idx_suppliers_org_seq         ON suppliers(organization_id, updated_seq);

CREATE TRIGGER trg_suppliers_updated_at
BEFORE UPDATE ON suppliers
FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_suppliers_updated_seq
BEFORE INSERT OR UPDATE ON suppliers
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_seq('seq_suppliers_updated');

-- ─── medications_master ───────────────────────────────────────────────────────

CREATE TABLE medications_master (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                  text        NOT NULL,
  generic_name          text,
  brand_name            text,
  dosage_form           text,          -- 'tablet', 'capsule', 'syrup', 'injection', …
  strength              text,          -- '500mg', '5mg/5ml', …
  unit_of_measure       text        NOT NULL DEFAULT 'units',
  barcode               text,
  category              text,
  requires_prescription boolean     NOT NULL DEFAULT false,
  reorder_point         integer     NOT NULL DEFAULT 0 CHECK (reorder_point >= 0),
  reorder_quantity      integer     NOT NULL DEFAULT 0 CHECK (reorder_quantity >= 0),
  selling_price         numeric(12,2) NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
  currency_code         char(3)     NOT NULL DEFAULT 'GHS',
  is_active             boolean     NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  updated_seq           bigint      NOT NULL DEFAULT nextval('seq_medications_updated')
);

-- Barcode must be unique within an org (not globally)
CREATE UNIQUE INDEX idx_medications_barcode
  ON medications_master(organization_id, barcode)
  WHERE barcode IS NOT NULL;

-- Composite index for sync pull queries
CREATE INDEX idx_medications_org_seq
  ON medications_master(organization_id, updated_seq);

-- Full-text search across name, generic_name, brand_name
CREATE INDEX idx_medications_fts
  ON medications_master
  USING GIN (
    to_tsvector('english',
      coalesce(name, '') || ' ' ||
      coalesce(generic_name, '') || ' ' ||
      coalesce(brand_name, '')
    )
  );

CREATE INDEX idx_medications_organization_id ON medications_master(organization_id);

CREATE TRIGGER trg_medications_updated_at
BEFORE UPDATE ON medications_master
FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_medications_updated_seq
BEFORE INSERT OR UPDATE ON medications_master
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_seq('seq_medications_updated');

-- ─── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE suppliers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications_master ENABLE ROW LEVEL SECURITY;

-- suppliers
CREATE POLICY "tenant_select" ON suppliers
  FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "tenant_insert" ON suppliers
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "tenant_update" ON suppliers
  FOR UPDATE
  USING    (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());

-- medications_master
CREATE POLICY "tenant_select" ON medications_master
  FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "tenant_insert" ON medications_master
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "tenant_update" ON medications_master
  FOR UPDATE
  USING    (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());
