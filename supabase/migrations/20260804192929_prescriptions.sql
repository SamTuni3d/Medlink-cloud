-- ============================================================
-- Migration 20260804192929: Prescriptions
-- Tracks patient prescriptions and their dispensing status.
-- Status lifecycle: pending → (partially_dispensed)* → dispensed | cancelled | expired
-- ============================================================

CREATE TYPE prescription_status AS ENUM (
  'pending',
  'partially_dispensed',
  'dispensed',
  'cancelled',
  'expired'
);

CREATE TYPE prescription_item_status AS ENUM (
  'pending',
  'partial',
  'dispensed',
  'cancelled'
);

-- ---------------------------------------------------------------------------
-- prescriptions
-- ---------------------------------------------------------------------------
CREATE TABLE prescriptions (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id               uuid        NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  rx_number               text        NOT NULL,
  patient_name            text        NOT NULL,
  patient_dob             date,
  patient_phone           text,
  prescriber_name         text        NOT NULL,
  prescriber_license      text,
  prescriber_phone        text,
  diagnosis               text,
  status                  prescription_status NOT NULL DEFAULT 'pending',
  notes                   text,
  issued_date             date        NOT NULL DEFAULT CURRENT_DATE,
  expiry_date             date,
  dispensed_by            uuid        REFERENCES users(id),
  dispensed_at            timestamptz,
  created_by              uuid        NOT NULL REFERENCES users(id),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_prescriptions_rx_number ON prescriptions(organization_id, rx_number);
CREATE INDEX idx_prescriptions_org     ON prescriptions(organization_id);
CREATE INDEX idx_prescriptions_branch  ON prescriptions(branch_id);
CREATE INDEX idx_prescriptions_status  ON prescriptions(status);
CREATE INDEX idx_prescriptions_created ON prescriptions(created_at DESC);

ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON prescriptions
  FOR SELECT USING (organization_id = (SELECT get_user_organization_id()));

CREATE POLICY "tenant_insert" ON prescriptions
  FOR INSERT WITH CHECK (organization_id = (SELECT get_user_organization_id()));

CREATE POLICY "tenant_update" ON prescriptions
  FOR UPDATE USING (organization_id = (SELECT get_user_organization_id()));

-- ---------------------------------------------------------------------------
-- prescription_items
-- ---------------------------------------------------------------------------
CREATE TABLE prescription_items (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id         uuid        NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  organization_id         uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  medication_id           uuid        NOT NULL REFERENCES medications_master(id),
  medication_name         text        NOT NULL,
  quantity_prescribed     integer     NOT NULL CHECK (quantity_prescribed > 0),
  quantity_dispensed      integer     NOT NULL DEFAULT 0 CHECK (quantity_dispensed >= 0),
  dosage_instructions     text,
  duration_days           integer,
  status                  prescription_item_status NOT NULL DEFAULT 'pending',
  sale_id                 uuid        REFERENCES sales(id),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_prescription_items_prescription ON prescription_items(prescription_id);
CREATE INDEX idx_prescription_items_org          ON prescription_items(organization_id);
CREATE INDEX idx_prescription_items_medication   ON prescription_items(medication_id);

ALTER TABLE prescription_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON prescription_items
  FOR SELECT USING (organization_id = (SELECT get_user_organization_id()));

CREATE POLICY "tenant_insert" ON prescription_items
  FOR INSERT WITH CHECK (organization_id = (SELECT get_user_organization_id()));

CREATE POLICY "tenant_update" ON prescription_items
  FOR UPDATE USING (organization_id = (SELECT get_user_organization_id()));

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_prescriptions_updated_at'
  ) THEN
    CREATE TRIGGER set_prescriptions_updated_at
      BEFORE UPDATE ON prescriptions
      FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_prescription_items_updated_at'
  ) THEN
    CREATE TRIGGER set_prescription_items_updated_at
      BEFORE UPDATE ON prescription_items
      FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- RPC: fn_next_rx_number — sequential Rx number per org per year
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_next_rx_number(p_organization_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year    text;
  v_seq     integer;
  v_number  text;
BEGIN
  v_year := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(rx_number, '-', 3) AS integer)
  ), 0) + 1
  INTO v_seq
  FROM prescriptions
  WHERE organization_id = p_organization_id
    AND rx_number LIKE 'RX-' || v_year || '-%';

  v_number := 'RX-' || v_year || '-' || LPAD(v_seq::text, 5, '0');
  RETURN v_number;
END;
$$;

REVOKE EXECUTE ON FUNCTION fn_next_rx_number(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION fn_next_rx_number(uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION fn_next_rx_number(uuid) TO service_role;
