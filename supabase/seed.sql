-- MedLink Cloud — Development Seed Data
-- Runs after all migrations on: supabase db reset
-- DO NOT add real credentials here.
-- System data (roles, permissions, role_permissions) is seeded in migration 002.

-- ─── Sample organization ──────────────────────────────────────────────────────

INSERT INTO organizations (id, name, registration_number, country, city, currency_code)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Accra Central Pharmacy',
  'PC-2024-001',
  'Ghana',
  'Accra',
  'GHS'
) ON CONFLICT (id) DO NOTHING;

-- ─── Sample branches ──────────────────────────────────────────────────────────

INSERT INTO branches (id, organization_id, name, address, phone)
VALUES
  (
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Main Branch',
    '14 Independence Avenue, Accra',
    '+233 30 000 0001'
  ),
  (
    'b0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'Osu Branch',
    '7 Oxford Street, Osu, Accra',
    '+233 30 000 0002'
  )
ON CONFLICT (id) DO NOTHING;

-- ─── Sample medications ───────────────────────────────────────────────────────

INSERT INTO medications_master (
  id, organization_id, name, generic_name, brand_name,
  dosage_form, strength, unit_of_measure,
  barcode, category, requires_prescription,
  reorder_point, reorder_quantity, selling_price, currency_code
) VALUES
  (
    'c0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Paracetamol 500mg Tablets', 'Paracetamol', 'Panadol',
    'tablet', '500mg', 'tabs',
    '6009705479842', 'Analgesics', false,
    100, 500, 0.50, 'GHS'
  ),
  (
    'c0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'Amoxicillin 250mg Capsules', 'Amoxicillin', 'Amoxil',
    'capsule', '250mg', 'caps',
    '6009705479843', 'Antibiotics', true,
    50, 200, 2.50, 'GHS'
  ),
  (
    'c0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000001',
    'Oral Rehydration Salts', 'ORS', 'Dioralyte',
    'sachet', '20.5g', 'sachets',
    '6009705479844', 'Electrolytes', false,
    200, 1000, 1.00, 'GHS'
  ),
  (
    'c0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000001',
    'Metformin 500mg Tablets', 'Metformin HCl', 'Glucophage',
    'tablet', '500mg', 'tabs',
    '6009705479845', 'Antidiabetics', true,
    80, 300, 0.80, 'GHS'
  )
ON CONFLICT (id) DO NOTHING;

-- ─── Sample inventory (Main Branch) ──────────────────────────────────────────
-- Note: current_stock is set here directly for seed data only.
-- In production, all stock changes go through stock_movements.

INSERT INTO inventory (organization_id, branch_id, medication_id, current_stock)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 450),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002',  80),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 900),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004',  60)
ON CONFLICT (branch_id, medication_id) DO NOTHING;

-- ─── Sample inventory batches (for FEFO testing) ─────────────────────────────

INSERT INTO inventory_batches (
  organization_id, branch_id, medication_id,
  batch_number, expiry_date, quantity_received, quantity_remaining,
  cost_price, currency_code, received_at
) VALUES
  -- Paracetamol: 3 batches at different expiry dates (tests FEFO ordering)
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001',
   'PAR-2024-A', '2026-09-30', 200, 200, 0.30, 'GHS', now() - interval '90 days'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001',
   'PAR-2024-B', '2026-07-15', 150, 150, 0.30, 'GHS', now() - interval '30 days'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000001',
   'PAR-2024-C', '2027-03-01', 100, 100, 0.28, 'GHS', now()),
  -- Amoxicillin: 1 batch expiring soon (tests critical expiry alert)
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
   'c0000000-0000-0000-0000-000000000002',
   'AMX-2024-A', '2026-07-01', 80, 80, 1.80, 'GHS', now() - interval '60 days')
ON CONFLICT DO NOTHING;
