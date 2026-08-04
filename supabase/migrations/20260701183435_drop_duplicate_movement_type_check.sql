-- ============================================================
-- Migration 20260701183435: Drop duplicate movement_type check constraint
-- After adding fn_void_sale, the movement_type CHECK on stock_movements
-- needed to include 'void_return'. A duplicate constraint existed;
-- this migration drops the old one and adds a single clean constraint
-- that includes all valid movement types including void_return.
-- ============================================================

ALTER TABLE stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check;

ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_movement_type_check
  CHECK (movement_type = ANY (ARRAY[
    'receipt',
    'sale',
    'adjustment',
    'transfer_in',
    'transfer_out',
    'expiry_write_off',
    'opening_stock',
    'void_return'
  ]));
